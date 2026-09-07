const fp = require('fastify-plugin');
const cookie = require('@fastify/cookie');
const { resolveAuthenticatedSession } = require('../lib/sessionResolver');

module.exports = fp(async (fastify, _opts) => {
  if (!process.env.JWT_SECRET || !process.env.COOKIE_SECRET) {
    throw new Error('JWT_SECRET and COOKIE_SECRET are required.');
  }

  fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET,
    parseOptions: {}
  });

  fastify.decorate('authenticate', async (request, reply) => {
    const resolved = await resolveAuthenticatedSession(fastify, request);
    if (!resolved) {
      request.user = null;
      request.sessionId = null;
      return reply.status(401).send({ error: 'Unauthorized', message: 'A valid session is required.' });
    }
    request.user = resolved.user;
    request.sessionId = resolved.sessionId;
  });

  // Optional gate: require an admin role (after authenticate).
  fastify.decorate('requireAdmin', async (request, reply) => {
    if (!request.user || request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required.' });
    }
  });
});
