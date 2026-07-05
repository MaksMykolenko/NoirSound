const { normalizeGenre } = require('../constants/musicGenres');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { serializePublicTrack } = require('../lib/publicTrack');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const { isQualifiedPlay, recalculateArtistMonthlyListeners } = require('../lib/statsAccess');
const { hasLyrics } = require('../lib/lyrics');

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
          isPublic: true,
          artist: { isHidden: false, user: { status: 'ACTIVE' } }
        }
      });
      if (!track) {
        return reply.status(404).send({ error: 'Track not found or not published' });
      }

      // Cap suspicious duration (e.g., max 1 hour per event just as a sanity check)
      const safeDuration = Math.min(durationListenedSeconds, 3600);

      // Recomputed from the reported duration vs. the track's real duration
      // -- min(30s, 50% of track length). A client-sent "completed"/
      // "qualified" flag is never trusted for this decision; only the
      // reported listened seconds and the track's own stored duration are.
      const qualified = isQualifiedPlay(safeDuration, track.durationSeconds);

      const playEvent = await fastify.prisma.playEvent.create({
        data: {
          trackId: request.params.id,
          userId,
          artistId: track.artistId,
          sessionId,
          durationListenedSeconds: safeDuration,
          completed: !!completed,
          qualified,
          source: source ? source.substring(0, 50) : null
        }
      });

      // Only a qualified play counts toward the public play counter and
      // (below) the artist's monthly-listener count -- see
      // NOIRSOUND_STATS_DATA_AUDIT.md for the exact rule.
      if (qualified) {
        await fastify.prisma.track.update({
          where: { id: track.id },
          data: { plays: { increment: 1 } }
        });
        if (track.artistId) {
          // Keeps ArtistProfile.monthlyListeners fresh on every qualifying
          // play rather than letting it go stale until an admin manually
          // recalculates. A pure recomputation (not an increment), so it
          // cannot drift even under concurrent qualifying plays.
          try {
            await recalculateArtistMonthlyListeners(fastify.prisma, track.artistId);
          } catch (recalcError) {
            // Never fail the play-event write because the derived monthly-
            // listener cache couldn't be refreshed -- it will self-correct
            // on the next qualifying play or admin recalculation.
            fastify.log.error(recalcError);
          }
        }
      }

      return { success: true, qualified, playEvent };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/me/listening-stats
  fastify.get('/me/listening-stats', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      // MVP: Calculate live from PlayEvent table to avoid background cron complexity.
      // Only `qualified` events count -- a click that never crossed the
      // min(30s, 50%) threshold is not a "listen" for stats purposes (see
      // NOIRSOUND_STATS_DATA_AUDIT.md, bug P-1).
      const playEvents = await fastify.prisma.playEvent.findMany({
        where: { userId: request.user.id, qualified: true },
        include: {
          track: {
            include: {
              artist: { include: { user: { select: { displayName: true, username: true, avatarUrl: true } } } }
            }
          }
        }
      });

      let totalListeningSeconds = 0;
      const uniqueArtists = new Set();
      const trackPlayCounts = new Map();
      const artistPlayCounts = new Map();
      const genreCounts = {};

      for (const event of playEvents) {
        totalListeningSeconds += event.durationListenedSeconds;

        if (event.artistId) {
          uniqueArtists.add(event.artistId);
          const existingArtist = artistPlayCounts.get(event.artistId);
          if (existingArtist) {
            existingArtist.count += 1;
          } else if (event.track?.artist) {
            artistPlayCounts.set(event.artistId, { artist: event.track.artist, count: 1 });
          }
        }

        if (event.trackId && event.track) {
          const existingTrack = trackPlayCounts.get(event.trackId);
          if (existingTrack) {
            existingTrack.count += 1;
          } else {
            trackPlayCounts.set(event.trackId, { track: event.track, count: 1 });
          }
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

      const topTracks = Array.from(trackPlayCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(({ track, count }) => ({ track: serializePublicTrack(track), playCount: count }))
        .filter((entry) => entry.track);

      const topArtists = Array.from(artistPlayCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(({ artist, count }) => ({
          id: artist.id,
          name: artist.user?.displayName || artist.user?.username || 'Unknown artist',
          username: artist.user?.username || null,
          avatarUrl: artist.user?.avatarUrl || null,
          playCount: count
        }));

      return {
        totalListeningSeconds,
        totalListeningMinutes,
        tracksPlayed,
        uniqueArtists: uniqueArtists.size,
        topGenre,
        topTrackId: topTracks[0]?.track?.id || null,
        topTracks,
        topArtists,
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
          // Only a genuinely valid (qualified) play belongs in "recently
          // played" -- a track that was clicked and immediately skipped
          // never counted as a real listen (see NOIRSOUND_STATS_DATA_AUDIT.md).
          qualified: true,
          track: {
            status: 'PUBLISHED',
            isPublic: true,
            artist: { isHidden: false, user: { status: 'ACTIVE' } }
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

  // GET /api/me/artist-dashboard
  // Always scoped to the caller's *own* ArtistProfile (looked up from
  // request.user.id, never from a client-supplied id) -- this is the only
  // shape that makes "an artist cannot access another artist's dashboard
  // stats" true by construction rather than by a permission check that
  // could later be forgotten on some other route.
  fastify.get('/me/artist-dashboard', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      const artistProfile = await fastify.prisma.artistProfile.findUnique({
        where: { userId: request.user.id },
        select: {
          id: true,
          monthlyListeners: true,
          isHidden: true,
          _count: { select: { followers: true } }
        }
      });
      if (!artistProfile) {
        return reply.status(404).send({
          error: 'ARTIST_PROFILE_REQUIRED',
          message: 'No artist profile exists for this account yet.'
        });
      }

      const tracks = await fastify.prisma.track.findMany({
        where: { artistId: artistProfile.id },
        select: {
          id: true,
          title: true,
          status: true,
          plays: true,
          likes: true,
          coverUrl: true,
          genre: true,
          lyricsText: true,
          lyricsType: true,
          lyricsSynced: true,
          lyricsRightsConfirmed: true,
          createdAt: true,
          updatedAt: true,
          publishedAt: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      const safeTracks = tracks.map((track) => {
        const {
          lyricsText: _lyricsText,
          lyricsSynced: _lyricsSynced,
          lyricsRightsConfirmed: _lyricsRightsConfirmed,
          ...safeTrack
        } = track;
        const available = hasLyrics(track);
        return {
          ...safeTrack,
          hasLyrics: available,
          lyricsType: available ? track.lyricsType : 'NONE'
        };
      });
      const publishedTracks = safeTracks.filter((track) => track.status === 'PUBLISHED');
      const topTracks = [...publishedTracks].sort((a, b) => b.plays - a.plays).slice(0, 10);
      // FAILED = processing/transcoding failed; REJECTED = failed moderation
      // review. Both belong in "failed", kept out of the published list.
      const failedUploads = safeTracks.filter((track) => track.status === 'FAILED' || track.status === 'REJECTED');
      const recentUploads = safeTracks.slice(0, 10); // already ordered by updatedAt desc
      const totalPlays = publishedTracks.reduce((sum, track) => sum + (track.plays || 0), 0);
      const totalLikes = publishedTracks.reduce((sum, track) => sum + (track.likes || 0), 0);

      return {
        followers: artistProfile._count.followers,
        monthlyListeners: artistProfile.monthlyListeners,
        isHidden: artistProfile.isHidden,
        totalPlays,
        totalLikes,
        publishedTrackCount: publishedTracks.length,
        // Every one of the artist's own tracks, any status, uncapped -- the
        // public GET /tracks feed is capped at 20 and is a *global* feed
        // ordered by publish date, so filtering it down to "my tracks" can
        // silently omit an artist's own older releases once enough other
        // artists have published more recently. This dashboard must never
        // depend on that capped, unrelated ordering for "do my own counts
        // match the database" to hold.
        tracks: safeTracks,
        topTracks,
        recentUploads,
        failedUploads,
        // Explicit, honest markers for genuinely unimplemented breakdowns --
        // the frontend renders these as "Not available yet", never a fake
        // chart or map. See NOIRSOUND_ARTIST_DASHBOARD_STATS_REPORT.md.
        geography: null,
        trends: null
      };
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
            isPublic: true,
            artist: { isHidden: false, user: { status: 'ACTIVE' } }
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
      // Every entry here is, by construction, already followed by the
      // caller -- no need for a second lookup, just mark it explicitly so
      // the shared ArtistCard component never has to guess/default this.
      const artists = follows.map((f) => f.artist && { ...f.artist, isFollowing: true }).filter(Boolean);
      return { data: artists };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = statsRoutes;
