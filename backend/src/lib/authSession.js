const jwt = require('jsonwebtoken');
const {
  hashToken,
  newSessionId,
  sessionExpiry,
  SESSION_TTL_DAYS
} = require('./session');

async function issueSession(fastify, reply, user, env = process.env) {
  const sid = newSessionId();
  const token = jwt.sign({ userId: user.id, sid }, env.JWT_SECRET, {
    expiresIn: `${SESSION_TTL_DAYS}d`
  });

  await fastify.prisma.session.create({
    data: {
      id: sid,
      userId: user.id,
      token: hashToken(token),
      expiresAt: sessionExpiry()
    }
  });

  reply.setCookie('token', token, {
    path: '/',
    httpOnly: true,
    secure: env.COOKIE_SECURE === 'true' || env.NODE_ENV === 'production',
    sameSite: env.COOKIE_SAME_SITE || 'lax',
    maxAge: 60 * 60 * 24 * SESSION_TTL_DAYS
  });
}

module.exports = { issueSession };
