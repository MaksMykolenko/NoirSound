const { serializePublicTrack } = require('../lib/publicTrack');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');

// Best-effort current-user id from the session cookie, without requiring
// authentication. Public artist routes stay public either way; when a
// viewer happens to be signed in we additionally tell them whether they
// already follow this artist, so the UI never has to guess/hardcode it.
function optionalUserId(request) {
  try {
    const raw = request.headers.cookie || '';
    const match = /(?:^|;\s*)token=([^;]+)/.exec(raw);
    if (!match || !process.env.JWT_SECRET) return null;
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(decodeURIComponent(match[1]), process.env.JWT_SECRET);
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

async function attachIsFollowing(prisma, artists, viewerId) {
  const list = Array.isArray(artists) ? artists : [artists];
  if (!viewerId) {
    return list.map((artist) => ({ ...artist, isFollowing: false }));
  }
  const follows = await prisma.artistFollow.findMany({
    where: { userId: viewerId, artistId: { in: list.map((artist) => artist.id) } },
    select: { artistId: true }
  });
  const followedIds = new Set(follows.map((follow) => follow.artistId));
  return list.map((artist) => ({ ...artist, isFollowing: followedIds.has(artist.id) }));
}

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
      const withFollowState = await attachIsFollowing(fastify.prisma, artists, optionalUserId(request));
      return { data: withFollowState };
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
      const [withFollowState] = await attachIsFollowing(fastify.prisma, cleanArtist, optionalUserId(request));
      return { artist: { ...withFollowState, genres: combinedGenres } };
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
  fastify.post('/:id/follow', {
    preValidation: [fastify.authenticate],
    config: {
      // Idempotent upsert already prevents duplicate rows/inflated counts;
      // this rate limit exists to stop follow/unfollow-cycling spam (e.g. a
      // script hammering the endpoint to pad notification/activity volume).
      rateLimit: { max: scaledRateLimitMax(30), timeWindow: '1 minute', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
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

      // Upsert on the composite key is inherently idempotent: a second
      // follow from the same user is a no-op, never a second row, so the
      // follower count (a live COUNT of ArtistFollow rows) can never be
      // inflated by a duplicate follow.
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

  // POST /api/artists/:id/unfollow
  // (POST rather than DELETE so both mutations share one simple, uniformly
  // CSRF/rate-limited shape; DELETE would work equally well but the frontend
  // client and every other mutation in this codebase already standardizes on
  // POST-with-action-suffix, e.g. /grant-artist, /revoke-artist.)
  fastify.post('/:id/unfollow', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(30), timeWindow: '1 minute', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    try {
      const artistProfile = await fastify.prisma.artistProfile.findFirst({
        where: { id: request.params.id },
        select: { id: true }
      });
      if (!artistProfile) {
        return reply.status(404).send({ error: 'Artist not found' });
      }

      // deleteMany (not delete) so unfollowing when not currently following
      // is a stable no-op (count: 0) rather than a P2025 "record not found"
      // error -- unfollow must be safe to call from a UI that is not 100%
      // sure of the current follow state.
      const result = await fastify.prisma.artistFollow.deleteMany({
        where: { userId: request.user.id, artistId: request.params.id }
      });
      const followerCount = await fastify.prisma.artistFollow.count({
        where: { artistId: request.params.id }
      });
      return { success: true, following: false, unfollowed: result.count > 0, followerCount };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = artistsRoutes;
