const { userOrIpKey } = require('../lib/rateLimitKeys');
const { serializePublicTrack } = require('../lib/publicTrack');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const { optionalAuthenticatedUserId } = require('../lib/optionalAuth');
const { auditData, createAudit } = require('../lib/auditLog');
const { hasLyrics, serializeLyrics, validateLyricsPayload } = require('../lib/lyrics');
const { parseTrackContentType } = require('../lib/trackContentType');
const { parseDiscoverQuery } = require('../lib/discoverQuery');
const { publicTrackWhere: publicVisibilityWhere } = require('../lib/publicVisibility');
const { getGenreFilterValues } = require('../constants/musicGenres');

const PUBLIC_TRACK_ARTIST_INCLUDE = {
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
};

function publicTrackWhere({ contentType, query, filters }) {
  return {
    ...publicVisibilityWhere(),
    ...(contentType ? { contentType } : {}),
    ...(filters.genre || filters.groupGenres
      ? { genre: { in: getGenreFilterValues(filters.genre ? [filters.genre] : filters.groupGenres), mode: 'insensitive' } }
      : {}),
    ...(filters.style ? { beatStyle: { contains: filters.style, mode: 'insensitive' } } : {}),
    ...(filters.mood ? { beatMood: { contains: filters.mood, mode: 'insensitive' } } : {}),
    ...(filters.key ? { beatKey: { equals: filters.key, mode: 'insensitive' } } : {}),
    ...(filters.bpmWhere ? { beatBpm: filters.bpmWhere } : {}),
    ...(query ? {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { genre: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { beatKey: { contains: query, mode: 'insensitive' } },
        { beatMood: { contains: query, mode: 'insensitive' } },
        { beatStyle: { contains: query, mode: 'insensitive' } },
        {
          artist: {
            user: {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { username: { contains: query, mode: 'insensitive' } }
              ]
            }
          }
        }
      ]
    } : {}),
  };
}

async function tracksRoutes(fastify, _options) {
  // A small, playable landing selection. Discovery deliberately includes
  // published tracks whose audio is not ready; this route uses the same
  // visibility policy and additionally verifies the processed object without
  // opening streams or recording playback. A missing object never becomes a
  // decorative/fake playable release, and client parameters cannot unbound it.
  fastify.get('/showcase', {
    config: { rateLimit: { max: scaledRateLimitMax(60), timeWindow: '1 minute', keyGenerator: userOrIpKey } }
  }, async (_request, reply) => {
    try {
      const groups = await Promise.all(['MUSIC', 'BEAT'].map(async (contentType) => {
        const candidates = await fastify.prisma.track.findMany({
          where: publicVisibilityWhere({
            contentType,
            processedAudioKey: { not: null },
            NOT: { processedAudioKey: '' }
          }),
          include: PUBLIC_TRACK_ARTIST_INCLUDE,
          orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
          take: 12
        });
        const tracks = [];
        for (const candidate of candidates) {
          const audio = await fastify.storage.getObjectMetadata(candidate.processedAudioKey);
          if (audio?.exists && Number(audio.size) > 0 && /^audio\//i.test(audio.mimeType || '')) {
            tracks.push(serializePublicTrack(candidate));
            if (tracks.length === 3) break;
          }
        }
        return [contentType, tracks];
      }));
      // Author visibility is checked for every request; do not cache revoked
      // or hidden releases in an independent landing recommendation cache.
      reply.header('cache-control', 'no-store');
      return { data: Object.fromEntries(groups) };
    } catch (error) {
      fastify.log.error(error, 'Landing showcase unavailable');
      return reply.status(503).send({ error: 'SHOWCASE_UNAVAILABLE' });
    }
  });

  // GET /api/tracks
  fastify.get('/', async (request, reply) => {
    try {
      const contentTypeResult = parseTrackContentType(request.query.contentType, {
        defaultValue: null
      });
      if (!contentTypeResult.ok) {
        return reply.status(400).send({
          error: contentTypeResult.error,
          message: contentTypeResult.message
        });
      }
      const discoverQueryResult = parseDiscoverQuery(request.query);
      if (!discoverQueryResult.ok) {
        return reply.status(400).send({
          error: discoverQueryResult.error,
          message: discoverQueryResult.message
        });
      }
      const filters = discoverQueryResult.value;
      const hasBeatFilter = Boolean(filters.style || filters.mood || filters.key || filters.bpm);
      if (hasBeatFilter && contentTypeResult.value !== 'BEAT') {
        return reply.status(400).send({
          error: 'BEAT_FILTER_REQUIRES_BEAT_CONTENT',
          message: 'Beat filters require contentType=BEAT.'
        });
      }
      const rawQuery = request.query.q;
      if (rawQuery !== undefined && (typeof rawQuery !== 'string' || rawQuery.trim().length > 120)) {
        return reply.status(400).send({
          error: 'SEARCH_QUERY_INVALID',
          message: 'Search query must be a string no longer than 120 characters.'
        });
      }
      const query = rawQuery?.trim();
      const where = publicTrackWhere({
        contentType: contentTypeResult.value,
        query,
        filters
      });

      if (filters.sort === 'trending') {
        const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        const rankedPlayEvents = await fastify.prisma.playEvent.groupBy({
          by: ['trackId'],
          where: {
            qualified: true,
            createdAt: { gte: cutoff },
            track: where
          },
          _count: { trackId: true },
          orderBy: [
            { _count: { trackId: 'desc' } },
            { trackId: 'asc' }
          ],
          skip: filters.skip,
          take: filters.limit
        });
        const rankedIds = rankedPlayEvents.map((entry) => entry.trackId);
        if (rankedIds.length > 0) {
          const tracks = await fastify.prisma.track.findMany({
            where: { ...where, id: { in: rankedIds } },
            include: PUBLIC_TRACK_ARTIST_INCLUDE
          });
          const tracksById = new Map(tracks.map((track) => [track.id, track]));
          return {
            data: rankedIds.map((id) => tracksById.get(id)).filter(Boolean).map(serializePublicTrack),
            meta: { page: filters.page, limit: filters.limit, sort: filters.sort, windowDays: 7 }
          };
        }
        return {
          data: [],
          meta: { page: filters.page, limit: filters.limit, sort: filters.sort, windowDays: 7 }
        };
      }

      const orderBy = filters.sort === 'played'
        ? [{ plays: 'desc' }, { publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }]
        : [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
      const tracks = await fastify.prisma.track.findMany({
        where,
        include: PUBLIC_TRACK_ARTIST_INCLUDE,
        orderBy,
        skip: filters.skip,
        take: filters.limit
      });
      return {
        data: tracks.map(serializePublicTrack),
        meta: {
          page: filters.page,
          limit: filters.limit,
          sort: filters.sort
        }
      };
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

  // GET /api/tracks/:id/lyrics — lazy public lyrics payload.
  fastify.get('/:id/lyrics', async (request, reply) => {
    try {
      const track = await fastify.prisma.track.findFirst({
        where: {
          id: request.params.id,
          ...publicVisibilityWhere()
        }
      });
      if (!track) {
        return reply.status(404).send({
          error: 'LYRICS_NOT_AVAILABLE',
          message: 'Lyrics are not available for this track.'
        });
      }
      return serializeLyrics(track);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/tracks/:id/lyrics/manage — full owner/admin editing payload,
  // including non-public moderation states. Never used for public display.
  fastify.get('/:id/lyrics/manage', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const track = await fastify.prisma.track.findUnique({
      where: { id: request.params.id },
      include: {
        artist: { select: { userId: true } }
      }
    });
    if (!track) {
      return reply.status(404).send({ error: 'Track not found' });
    }
    if (request.user.role !== 'ADMIN' && track.artist.userId !== request.user.id) {
      return reply.status(403).send({ error: 'You cannot edit lyrics for this track.' });
    }
    return serializeLyrics(track);
  });

  // PATCH /api/tracks/:id/lyrics — owner/admin lyrics editing. The global
  // CSRF hook protects this state-changing browser request.
  fastify.patch('/:id/lyrics', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(30),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const track = await fastify.prisma.track.findUnique({
      where: { id: request.params.id },
      include: {
        artist: { select: { userId: true } }
      }
    });
    if (!track) {
      return reply.status(404).send({ error: 'Track not found' });
    }
    const isAdmin = request.user.role === 'ADMIN';
    if (!isAdmin && track.artist.userId !== request.user.id) {
      return reply.status(403).send({ error: 'You cannot edit lyrics for this track.' });
    }

    const lyricsResult = validateLyricsPayload(request.body);
    if (!lyricsResult.ok) {
      return reply.status(400).send({
        error: lyricsResult.error,
        message: lyricsResult.message
      });
    }
    const { hasLyrics: nextHasLyrics, ...lyricsData } = lyricsResult.data;
    const previousHasLyrics = hasLyrics(track);
    const lyricsUpdatedAt = new Date();
    await fastify.prisma.$transaction(async (tx) => {
      await tx.track.update({
        where: { id: track.id },
        data: { ...lyricsData, lyricsUpdatedAt }
      });
      await createAudit(tx, auditData(
        request.user.id,
        isAdmin
          ? 'TRACK_LYRICS_MODERATED'
          : nextHasLyrics
            ? 'TRACK_LYRICS_UPDATED'
            : 'TRACK_LYRICS_REMOVED',
        'TRACK',
        track.id,
        isAdmin ? 'Administrator updated track lyrics.' : 'Track owner updated lyrics.',
        {
          previousHasLyrics,
          hasLyrics: nextHasLyrics,
          lyricsType: lyricsData.lyricsType,
          lyricsLanguage: lyricsData.lyricsLanguage
        }
      ));
    });

    return {
      id: track.id,
      hasLyrics: nextHasLyrics,
      lyricsType: lyricsData.lyricsType,
      lyricsLanguage: lyricsData.lyricsLanguage,
      lyricsUpdatedAt
    };
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
        // Resolve the final query before the interactive transaction callback
        // returns. Handing Prisma's thenable straight back lets the pg adapter
        // begin transaction cleanup while the query is still in flight.
        const trackCount = await tx.track.count({ where: { id: request.params.id } });
        return trackCount;
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
          ...publicVisibilityWhere()
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
          ...publicVisibilityWhere()
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
