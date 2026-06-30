const { normalizeGenre } = require('../constants/musicGenres');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { serializePublicTrack } = require('../lib/publicTrack');
const { scaledRateLimitMax } = require('../lib/rateLimit');

async function statsRoutes(fastify, _options) {
  // POST /api/tracks/:id/play-event
  fastify.post('/tracks/:id/play-event', {
    config: {
      // Prevents play-count inflation via event spam (per user, else per IP).
      rateLimit: { max: scaledRateLimitMax(60), timeWindow: '1 minute', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    // Optionally authenticating
    let userId = null;
    try {
      const token = request.cookies.token;
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      }
    } catch {
      // ignore, anonymous user
    }

    const { durationListenedSeconds, completed, source, sessionId } = request.body;

    if (typeof durationListenedSeconds !== 'number' || durationListenedSeconds < 0) {
      return reply.status(400).send({ error: 'Invalid duration' });
    }

    try {
      const track = await fastify.prisma.track.findFirst({
        where: {
          id: request.params.id,
          status: 'PUBLISHED',
          artist: { user: { status: 'ACTIVE' } }
        }
      });
      if (!track) {
        return reply.status(404).send({ error: 'Track not found or not published' });
      }

      // Cap suspicious duration (e.g., max 1 hour per event just as a sanity check)
      const safeDuration = Math.min(durationListenedSeconds, 3600);

      const playEvent = await fastify.prisma.playEvent.create({
        data: {
          trackId: request.params.id,
          userId,
          artistId: track.artistId,
          sessionId,
          durationListenedSeconds: safeDuration,
          completed: !!completed,
          source: source ? source.substring(0, 50) : null
        }
      });

      // Increment track plays if listened more than 30 seconds
      if (safeDuration >= 30) {
        await fastify.prisma.track.update({
          where: { id: track.id },
          data: { plays: { increment: 1 } }
        });
      }

      return { success: true, playEvent };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/me/listening-stats
  fastify.get('/me/listening-stats', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      // MVP: Calculate live from PlayEvent table to avoid background cron complexity
      const playEvents = await fastify.prisma.playEvent.findMany({
        where: { userId: request.user.id },
        include: { track: true }
      });

      let totalListeningSeconds = 0;
      const uniqueArtists = new Set();
      const trackPlayCounts = {};
      const genreCounts = {};
      
      for (const event of playEvents) {
        totalListeningSeconds += event.durationListenedSeconds;
        
        if (event.artistId) {
          uniqueArtists.add(event.artistId);
        }

        if (event.trackId) {
          trackPlayCounts[event.trackId] = (trackPlayCounts[event.trackId] || 0) + 1;
        }

        if (event.track && event.track.genre) {
          // Aggregate on the normalized key so legacy/mixed-case genres collapse
          // together. Unknown values fall back to a lowercased raw key (still
          // displayed safely by the frontend).
          const genreKey =
            normalizeGenre(event.track.genre) || String(event.track.genre).trim().toLowerCase();
          if (genreKey) {
            genreCounts[genreKey] = (genreCounts[genreKey] || 0) + 1;
          }
        }
      }

      const totalListeningMinutes = Math.floor(totalListeningSeconds / 60);
      const tracksPlayed = playEvents.length;
      
      let topGenre = null;
      let topGenreCount = 0;
      for (const [genre, count] of Object.entries(genreCounts)) {
        if (count > topGenreCount) {
          topGenreCount = count;
          topGenre = genre;
        }
      }

      let topTrackId = null;
      let topTrackCount = 0;
      for (const [trackId, count] of Object.entries(trackPlayCounts)) {
        if (count > topTrackCount) {
          topTrackCount = count;
          topTrackId = trackId;
        }
      }

      return {
        totalListeningSeconds,
        totalListeningMinutes,
        tracksPlayed,
        uniqueArtists: uniqueArtists.size,
        topGenre,
        topTrackId,
        topGenres: Object.entries(genreCounts).map(([genre, count]) => ({
          genre,
          percent: Math.round((count / playEvents.length) * 100) || 0
        })).sort((a, b) => b.percent - a.percent).slice(0, 5)
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/me/recently-played
  fastify.get('/me/recently-played', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      const recentEvents = await fastify.prisma.playEvent.findMany({
        where: {
          userId: request.user.id,
          track: {
            status: 'PUBLISHED',
            artist: { user: { status: 'ACTIVE' } }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          track: {
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
          }
        }
      });

      // deduplicate
      const seenTracks = new Set();
      const recentlyPlayed = [];

      for (const event of recentEvents) {
        if (!seenTracks.has(event.trackId)) {
          seenTracks.add(event.trackId);
          recentlyPlayed.push({
            track: serializePublicTrack(event.track),
            lastPlayedAt: event.createdAt,
            durationListenedSeconds: event.durationListenedSeconds
          });
        }
        if (recentlyPlayed.length >= 10) break;
      }

      return { data: recentlyPlayed };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/me/liked-tracks
  fastify.get('/me/liked-tracks', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      const likes = await fastify.prisma.trackLike.findMany({
        where: {
          userId: request.user.id,
          track: {
            status: 'PUBLISHED',
            artist: { user: { status: 'ACTIVE' } }
          }
        },
        orderBy: { createdAt: 'desc' },
        include: {
          track: {
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
          }
        }
      });
      const tracks = likes.map((like) => serializePublicTrack(like.track)).filter(Boolean);
      return { data: tracks };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/me/followed-artists
  fastify.get('/me/followed-artists', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      const follows = await fastify.prisma.artistFollow.findMany({
        where: { userId: request.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          artist: {
            include: {
              user: {
                select: {
                  displayName: true,
                  username: true,
                  avatarUrl: true,
                  bannerUrl: true,
                  bio: true
                }
              },
              _count: { select: { followers: true } }
            }
          }
        }
      });
      const artists = follows.map((f) => f.artist).filter(Boolean);
      return { data: artists };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = statsRoutes;
