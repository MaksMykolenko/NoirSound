'use strict';

const { parseCatalogQuery, decodeCatalogCursor, searchCatalog } = require('../lib/catalogSearch');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const { userOrIpKey } = require('../lib/rateLimitKeys');

async function discoverRoutes(fastify) {
  fastify.get('/catalog', {
    config: { rateLimit: { max: scaledRateLimitMax(120), timeWindow: '1 minute', keyGenerator: userOrIpKey } },
  }, async (request, reply) => {
    const parsed = parseCatalogQuery(request.query);
    if (!parsed.ok) return reply.status(400).send(parsed);
    const decoded = decodeCatalogCursor(parsed.value);
    if (!decoded.ok) return reply.status(400).send(decoded);
    try {
      // Public results are deliberately role-independent. No authenticated
      // private material or personalized like state enters catalog aggregates.
      reply.header('Cache-Control', 'no-store');
      return await searchCatalog(fastify.prisma, parsed.value, decoded);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'CATALOG_UNAVAILABLE', message: 'The catalog is temporarily unavailable.' });
    }
  });
}

module.exports = discoverRoutes;
