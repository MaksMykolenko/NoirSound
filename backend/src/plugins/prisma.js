const fp = require('fastify-plugin');
const { createPrismaClient } = require('../lib/prisma');

module.exports = fp(async (fastify, opts) => {
  let prisma = opts.client || null;
  const ownsClient = !prisma;
  if (ownsClient) {
    try {
      prisma = createPrismaClient();
      await prisma.$connect();
      fastify.log.info('Prisma connected to PostgreSQL via pg adapter');
    } catch (err) {
      fastify.log.warn('Could not connect to PostgreSQL database. Error: ' + err.message);
    }
  }

  // Make Prisma available through fastify.prisma
  fastify.decorate('prisma', prisma || {});

  fastify.addHook('onClose', async (fastifyInstance) => {
    if (ownsClient && fastifyInstance.prisma?.$disconnect) {
      await fastifyInstance.prisma.$disconnect().catch(() => {});
    }
  });
});
