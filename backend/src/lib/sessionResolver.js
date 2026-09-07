'use strict';

const jwt = require('jsonwebtoken');
const { hashToken } = require('./session');

/** Resolve a browser session against current server state. Never trust request.user
 * or a JWT role claim: revocation and role/status changes apply on every request. */
async function resolveAuthenticatedSession(fastify, request) {
  const token = request.cookies?.token;
  if (typeof token !== 'string' || !token || !process.env.JWT_SECRET) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (
      typeof decoded?.userId !== 'string' || !decoded.userId
      || typeof decoded.sid !== 'string' || !decoded.sid
      || typeof decoded.exp !== 'number'
    ) return null;

    const session = await fastify.prisma.session.findUnique({ where: { id: decoded.sid } });
    const expiry = session?.expiresAt instanceof Date ? session.expiresAt.getTime() : NaN;
    if (!session || session.userId !== decoded.userId || !Number.isFinite(expiry)
      || expiry <= Date.now() || session.token !== hashToken(token)) return null;

    const user = await fastify.prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.status !== 'ACTIVE') return null;

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { user: safeUser, sessionId: decoded.sid };
  } catch {
    // Invalid credentials and unavailable session state both fail closed.
    return null;
  }
}

module.exports = { resolveAuthenticatedSession };
