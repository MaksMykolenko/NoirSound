const fp = require('fastify-plugin');
const cookie = require('@fastify/cookie');
const jwt = require('jsonwebtoken');
const { hashToken } = require('../lib/session');

module.exports = fp(async (fastify, _opts) => {
  if (!process.env.JWT_SECRET || !process.env.COOKIE_SECRET) {
    throw new Error('JWT_SECRET and COOKIE_SECRET are required.');
  }

  fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET,
    parseOptions: {}
  });

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      const token = request.cookies.token;
      if (!token) {
        throw new Error('No token provided');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Server-side session check: the JWT carries an opaque session id (`sid`).
      // A session can be revoked (logout / logout-all / admin action) by
      // deleting its row, which immediately invalidates the still-unexpired JWT.
      if (!decoded.sid) {
        throw new Error('Session is no longer valid');
      }
      const session = await fastify.prisma.session.findUnique({
        where: { id: decoded.sid }
      });
      if (
        !session ||
        session.userId !== decoded.userId ||
        session.expiresAt.getTime() <= Date.now() ||
        session.token !== hashToken(token)
      ) {
        throw new Error('Session is no longer valid');
      }

      // Look up user from DB to ensure they still exist and get latest role/status.
      const user = await fastify.prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new Error('User is not active');
      }

      const { passwordHash: _passwordHash, ...safeUser } = user;
      request.user = safeUser;
      request.sessionId = decoded.sid;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized', message: err.message });
    }
  });

  // Optional gate: require an admin role (after authenticate).
  fastify.decorate('requireAdmin', async (request, reply) => {
    if (!request.user || request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required.' });
    }
  });
});
