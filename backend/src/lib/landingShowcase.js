'use strict';

const { publicTrackWhere } = require('./publicVisibility');
const { userOrIpKey } = require('./rateLimitKeys');
const { scaledRateLimitMax } = require('./rateLimit');
const { hasLyrics } = require('./lyrics');

const showcaseWhere = (extra = {}) => publicTrackWhere({
  ...extra, processedAudioKey: { not: null }, NOT: { processedAudioKey: '' }
});
const showcaseSelect = {
  id: true, title: true, genre: true, contentType: true, durationSeconds: true,
  beatBpm: true, beatKey: true, artistId: true, processedAudioKey: true, coverImageKey: true,
  lyricsType: true, lyricsText: true, lyricsSynced: true, lyricsRightsConfirmed: true,
  artist: { select: { id: true, user: { select: { displayName: true, username: true } } } }
};
const playableObject = object => object?.exists && Number(object.size) > 0 && /^audio\//i.test(object.mimeType || '');

// A purpose-specific allowlist: new Track/User columns cannot become public
// merely because a Prisma include or the main catalog serializer changes.
function serializeLandingTrack(track) {
  return {
    id: track.id, title: track.title, genre: track.genre, contentType: track.contentType,
    durationSeconds: track.durationSeconds, beatBpm: track.beatBpm, beatKey: track.beatKey,
    artistId: track.artistId, artist: { id: track.artist?.id, user: {
      displayName: track.artist?.user?.displayName, username: track.artist?.user?.username
    } },
    isStreamable: true, hasCoverImage: Boolean(track.coverImageKey),
    hasLyrics: hasLyrics(track), lyricsType: hasLyrics(track) ? track.lyricsType : 'NONE'
  };
}

function registerShowcase(fastify, path) {
  fastify.get(path, {
    config: { rateLimit: { max: scaledRateLimitMax(60), timeWindow: '1 minute', keyGenerator: userOrIpKey } }
  }, async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const groups = await Promise.all(['MUSIC', 'BEAT'].map(async contentType => {
        const candidates = await fastify.prisma.track.findMany({
          where: showcaseWhere({ contentType }), select: showcaseSelect,
          orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }], take: 12
        });
        const tracks = [];
        for (const candidate of candidates) {
          if (playableObject(await fastify.storage.getObjectMetadata(candidate.processedAudioKey))) {
            tracks.push(serializeLandingTrack(candidate));
            if (tracks.length === 3) break;
          }
        }
        return [contentType, tracks];
      }));
      return { data: Object.fromEntries(groups) };
    } catch (error) {
      fastify.log.error(error, 'Landing showcase unavailable');
      return reply.status(503).send({ error: 'SHOWCASE_UNAVAILABLE' });
    }
  });
}

module.exports = { registerShowcase, showcaseWhere, showcaseSelect, playableObject, serializeLandingTrack };
