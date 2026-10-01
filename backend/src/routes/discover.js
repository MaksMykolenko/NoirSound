'use strict';

const { parseCatalogQuery, decodeCatalogCursor, searchCatalog } = require('../lib/catalogSearch');
const { requestBetaUser, publicBeta } = require('../lib/externalCatalog');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const { userOrIpKey } = require('../lib/rateLimitKeys');

async function discoverRoutes(fastify) {
  fastify.get('/catalog', {
    config: { rateLimit: { max: scaledRateLimitMax(120), timeWindow: '1 minute', keyGenerator: userOrIpKey } },
  }, async (request, reply) => {
    const parsed = parseCatalogQuery(request.query);
    if (!parsed.ok) return reply.status(400).send(parsed);
    const betaUser = await requestBetaUser(fastify, request);
    if (betaUser) {parsed.value.externalUserId = betaUser.id;parsed.value.publicExternalCatalog=publicBeta();}
    const decoded = decodeCatalogCursor(parsed.value);
    if (!decoded.ok) return reply.status(400).send(decoded);
    try {
      // The private extension is derived from the server session and beta gate;
      // clients cannot request another user's scope through query parameters.
      reply.header('Cache-Control', betaUser ? 'private, no-store' : 'no-store');
      return await searchCatalog(fastify.prisma, parsed.value, decoded);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'CATALOG_UNAVAILABLE', message: 'The catalog is temporarily unavailable.' });
    }
  });
}

module.exports = discoverRoutes;
