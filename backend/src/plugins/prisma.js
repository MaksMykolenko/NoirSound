const fp = require('fastify-plugin');
const { createPrismaClient } = require('../lib/prisma');

module.exports = fp(async (fastify, _opts) => {
  let prisma = null;
  try {
    prisma = createPrismaClient();
    await prisma.$connect();
    fastify.log.info('Prisma connected to PostgreSQL via pg adapter');
  } catch (err) {
    fastify.log.warn('Could not connect to PostgreSQL database. Error: ' + err.message);
  }

  // Make Prisma available through fastify.prisma
  fastify.decorate('prisma', prisma || {});

  fastify.addHook('onClose', async (fastifyInstance) => {
    if (fastifyInstance.prisma?.$disconnect) {
      await fastifyInstance.prisma.$disconnect().catch(() => {});
    }
  });
});
