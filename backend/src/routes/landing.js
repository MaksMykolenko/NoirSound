'use strict';

const { registerShowcase, showcaseWhere, playableObject } = require('../lib/landingShowcase');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');

module.exports = async function landingRoutes(fastify) {
  registerShowcase(fastify, '/showcase');
  for (const kind of ['stream', 'cover']) {
    fastify.get(`/tracks/:id/${kind}`, {
      config: { rateLimit: { max: scaledRateLimitMax(120), timeWindow: '1 minute', keyGenerator: userOrIpKey } }
    }, async (request, reply) => {
      reply.header('cache-control', 'no-store');
      try {
        // Recheck publication, privacy, author and audio at the time of access.
        // Private-owner and administrator exceptions belong to the full app.
        const track = await fastify.prisma.track.findFirst({
          where: showcaseWhere({ id: request.params.id }),
          select: { processedAudioKey: true, coverImageKey: true }
        });
        if (!track || !playableObject(await fastify.storage.getObjectMetadata(track.processedAudioKey))) {
          return reply.code(404).send({ error: 'LANDING_MEDIA_NOT_FOUND' });
        }
        const key = kind === 'stream' ? track.processedAudioKey : track.coverImageKey;
        if (!key) return reply.code(404).send({ error: 'LANDING_MEDIA_NOT_FOUND' });
        // Preserve the private bucket's signed-GET architecture, with a bounded
        // five-minute capability. Redirects support the existing Range/seek flow.
        const url = await fastify.storage.createPresignedGetUrl(key, 300);
        return reply.redirect(url, 302);
      } catch (error) {
        fastify.log.error(error, 'Landing media unavailable');
        return reply.code(503).send({ error: 'LANDING_MEDIA_UNAVAILABLE' });
      }
    });
  }
};
