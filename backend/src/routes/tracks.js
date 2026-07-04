const { userOrIpKey } = require('../lib/rateLimitKeys');
const { serializePublicTrack } = require('../lib/publicTrack');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const { optionalAuthenticatedUserId } = require('../lib/optionalAuth');

async function tracksRoutes(fastify, _options) {
  // GET /api/tracks
  fastify.get('/', async (request, reply) => {
    try {
      const tracks = await fastify.prisma.track.findMany({
        where: {
          status: 'PUBLISHED',
          isPublic: true,
          artist: { isHidden: false, user: { status: 'ACTIVE' } }
        },
        include: {
          artist: {
            include: {
              user: {
                select: {
                  displayName: true,
                  username: true,
                  avatarUrl: true
                }
              }
            }
          }
        },
        orderBy: { publishedAt: 'desc' },
        take: 20
      });
      return { data: tracks.map(serializePublicTrack) };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/tracks/:id
  fastify.get('/:id', async (request, reply) => {
    try {
      const viewerId = await optionalAuthenticatedUserId(fastify, request);
      const track = await fastify.prisma.track.findFirst({
        where: {
          id: request.params.id,
          status: 'PUBLISHED',
          OR: [
            { isPublic: true },
            ...(viewerId ? [{ artist: { userId: viewerId } }] : [])
          ],
          artist: { isHidden: false, user: { status: 'ACTIVE' } }
        },
        include: {
          artist: {
            include: {
              user: {
                select: {
                  displayName: true,
                  username: true,
                  avatarUrl: true
                }
              }
            }
          }
        }
      });
      if (!track) {
        return reply.status(404).send({ error: 'Track not found' });
      }
      return { track: serializePublicTrack(track) };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/tracks/:id/stream
  fastify.get('/:id/stream', async (request, reply) => {
    try {
      const track = await fastify.prisma.track.findUnique({
        where: { id: request.params.id },
        include: { artist: { include: { user: { select: { id: true, status: true } } } } }
      });
      const viewerId = track?.isPublic ? null : await optionalAuthenticatedUserId(fastify, request);
      if (
        !track
        || track.status !== 'PUBLISHED'
        || (!track.isPublic && track.artist?.user?.id !== viewerId)
      ) {
        return reply.status(404).send({ error: 'Track not found or not published' });
      }
      // Block streaming for tracks owned by a suspended/banned/deleted artist.
      if (track.artist?.isHidden || track.artist?.user?.status !== 'ACTIVE') {
        return reply.status(404).send({ error: 'Track not available' });
      }
      if (!track.processedAudioKey) {
        return reply.status(404).send({ error: 'Streamable audio not found' });
      }

      const streamUrl = await fastify.storage.getPublicOrSignedUrl(
        track.processedAudioKey
      );
      
      // Redirect to the S3 URL
      return reply.redirect(streamUrl, 302);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/tracks/:id/cover
  fastify.get('/:id/cover', async (request, reply) => {
    try {
      const viewerId = await optionalAuthenticatedUserId(fastify, request);
      const track = await fastify.prisma.track.findFirst({
        where: {
          id: request.params.id,
          status: 'PUBLISHED',
          OR: [
            { isPublic: true },
            ...(viewerId ? [{ artist: { userId: viewerId } }] : [])
          ],
          artist: { isHidden: false, user: { status: 'ACTIVE' } }
        },
        select: { coverImageKey: true }
      });
      if (!track || !track.coverImageKey) {
        return reply.status(404).send({ error: 'Track cover not found' });
      }

      const coverUrl = await fastify.storage.createPresignedGetUrl(
        track.coverImageKey,
        3600
      );
      return reply.redirect(coverUrl, 302);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/tracks/:id/like
  fastify.post('/:id/like', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      const trackExists = await fastify.prisma.$transaction(async (tx) => {
        const existing = await tx.trackLike.findUnique({
          where: {
            userId_trackId: {
              userId: request.user.id,
              trackId: request.params.id
            }
          }
        });
        if (!existing) {
          await tx.trackLike.create({
            data: {
              userId: request.user.id,
              trackId: request.params.id
            }
          });
          await tx.track.update({
            where: { id: request.params.id },
            data: { likes: { increment: 1 } }
          });
        }
        return tx.track.count({ where: { id: request.params.id } });
      });
      if (trackExists === 0) {
        return reply.status(404).send({ error: 'Track not found' });
      }
      return { success: true, liked: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // DELETE /api/tracks/:id/like
  fastify.delete('/:id/like', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      await fastify.prisma.$transaction(async (tx) => {
        const deleted = await tx.trackLike.deleteMany({
          where: {
            userId: request.user.id,
            trackId: request.params.id
          }
        });
        if (deleted.count > 0) {
          await tx.track.update({
            where: { id: request.params.id },
            data: { likes: { decrement: 1 } }
          });
        }
      });
      return { success: true, liked: false };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/tracks/:id/comments
  fastify.get('/:id/comments', async (request, reply) => {
    try {
      const track = await fastify.prisma.track.findFirst({
        where: {
          id: request.params.id,
          status: 'PUBLISHED',
          isPublic: true,
          artist: { isHidden: false, user: { status: 'ACTIVE' } }
        }
      });
      if (!track) {
        return reply.status(404).send({ error: 'Track not found or not published' });
      }

      const comments = await fastify.prisma.comment.findMany({
        where: { trackId: request.params.id, parentId: null },
        include: {
          user: { select: { displayName: true, username: true, avatarUrl: true } },
          replies: {
            include: { user: { select: { displayName: true, username: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { data: comments };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/tracks/:id/comments
  fastify.post('/:id/comments', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(30), timeWindow: '10 minutes', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    const { text } = request.body;
    if (!text || text.length > 1000) {
      return reply.status(400).send({ error: 'Text is required and must be < 1000 chars' });
    }

    try {
      const track = await fastify.prisma.track.findFirst({
        where: {
          id: request.params.id,
          status: 'PUBLISHED',
          isPublic: true,
          artist: { isHidden: false, user: { status: 'ACTIVE' } }
        }
      });
      if (!track) {
        // Simple MVP rule: only comment on published tracks (unless admin/owner, skipping that logic for MVP simplicity)
        return reply.status(404).send({ error: 'Track not found or not published' });
      }

      // Very simple sanitization
      const sanitizedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const comment = await fastify.prisma.comment.create({
        data: {
          trackId: request.params.id,
          userId: request.user.id,
          text: sanitizedText
        },
        include: {
          user: { select: { displayName: true, username: true, avatarUrl: true } }
        }
      });
      return { comment };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = tracksRoutes;
