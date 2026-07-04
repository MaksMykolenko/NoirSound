'use strict';

const jwt = require('jsonwebtoken');
const { hashToken } = require('./session');

async function optionalAuthenticatedUserId(fastify, request) {
  try {
    const token = request.cookies?.token;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.sid || !decoded.userId) return null;
    const [session, user] = await Promise.all([
      fastify.prisma.session.findUnique({ where: { id: decoded.sid } }),
      fastify.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, status: true }
      })
    ]);
    if (
      !session
      || session.userId !== decoded.userId
      || session.expiresAt.getTime() <= Date.now()
      || session.token !== hashToken(token)
      || user?.status !== 'ACTIVE'
    ) {
      return null;
    }
    return user.id;
  } catch {
    return null;
  }
}

module.exports = { optionalAuthenticatedUserId };
