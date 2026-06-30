const { serializePublicTrack } = require('../lib/publicTrack');

async function artistsRoutes(fastify, _options) {
  // GET /api/artists
  // Supports ?hasPublishedTracks=true to return only artists with at least one PUBLISHED track.
  fastify.get('/', async (request, reply) => {
    try {
      const filterPublished = request.query.hasPublishedTracks === 'true';

      const where = {
        isHidden: false,
        user: { status: 'ACTIVE' },
        ...(filterPublished ? { tracks: { some: { status: 'PUBLISHED' } } } : {})
      };

      const artists = await fastify.prisma.artistProfile.findMany({
        where,
        include: {
          user: { select: { displayName: true, username: true, avatarUrl: true } },
          _count: { select: { followers: true } }
        }
      });
      return { data: artists };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/artists/:id
  fastify.get('/:id', async (request, reply) => {
    try {
      const artist = await fastify.prisma.artistProfile.findFirst({
        where: { id: request.params.id, isHidden: false, user: { status: 'ACTIVE' } },
        include: {
          user: { select: { displayName: true, username: true, avatarUrl: true, bannerUrl: true, bio: true } },
          tracks: { where: { status: 'PUBLISHED' }, select: { genre: true }, take: 20 },
          _count: { select: { followers: true } }
        }
      });
      if (!artist) {
        return reply.status(404).send({ error: 'Artist not found' });
      }

      const FORBIDDEN_GENRES = new Set([
        'ADMIN', 'SYSTEM_ADMIN', 'LISTENER', 'ARTIST', 'USER', 'PLAYER',
        'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED', 'SYSTEM', 'ROLE'
      ]);

      const trackGenres = (artist.tracks || []).map((t) => t.genre).filter(Boolean);
      const profileGenres = (artist.genres || []).filter(Boolean);
      const combinedGenres = Array.from(new Set([...trackGenres, ...profileGenres]))
        .map((g) => String(g).trim())
        .filter((g) => Boolean(g) && !FORBIDDEN_GENRES.has(g.toUpperCase()));

      const { tracks: _, ...cleanArtist } = artist;
      return { artist: { ...cleanArtist, genres: combinedGenres } };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/artists/:id/tracks
  fastify.get('/:id/tracks', async (request, reply) => {
    try {
      const artist = await fastify.prisma.artistProfile.findFirst({
        where: { id: request.params.id, isHidden: false, user: { status: 'ACTIVE' } },
        select: { id: true }
      });
      if (!artist) {
        return reply.status(404).send({ error: 'Artist not found' });
      }

      const tracks = await fastify.prisma.track.findMany({
        where: {
          artistId: artist.id,
          status: 'PUBLISHED'
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
        orderBy: { publishedAt: 'desc' }
      });
      return { data: tracks.map(serializePublicTrack) };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/artists/:id/follow
  fastify.post('/:id/follow', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      const artistProfile = await fastify.prisma.artistProfile.findFirst({
        where: { id: request.params.id, isHidden: false, user: { status: 'ACTIVE' } },
        select: { userId: true }
      });
      if (!artistProfile) {
        return reply.status(404).send({ error: 'Artist not found' });
      }
      if (artistProfile.userId === request.user.id) {
        return reply.status(400).send({ error: 'You cannot follow your own artist profile' });
      }

      await fastify.prisma.artistFollow.upsert({
        where: {
          userId_artistId: {
            userId: request.user.id,
            artistId: request.params.id
          }
        },
        update: {},
        create: {
          userId: request.user.id,
          artistId: request.params.id
        }
      });
      const followerCount = await fastify.prisma.artistFollow.count({
        where: { artistId: request.params.id }
      });
      return { success: true, following: true, followerCount };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = artistsRoutes;
