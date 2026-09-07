const jwt = require('jsonwebtoken');
const {
  hashToken,
  newSessionId,
  sessionExpiry,
  SESSION_TTL_DAYS
} = require('./session');

async function createSession(client, user, env = process.env) {
  const sid = newSessionId();
  const token = jwt.sign({ userId: user.id, sid }, env.JWT_SECRET, {
    expiresIn: `${SESSION_TTL_DAYS}d`
  });

  await client.session.create({
    data: {
      id: sid,
      userId: user.id,
      token: hashToken(token),
      expiresAt: sessionExpiry()
    }
  });

  return token;
}

function setSessionCookie(reply, token, env = process.env) {
  reply.setCookie('token', token, {
    path: '/',
    httpOnly: true,
    secure: env.COOKIE_SECURE === 'true' || env.NODE_ENV === 'production',
    sameSite: env.COOKIE_SAME_SITE || 'lax',
    maxAge: 60 * 60 * 24 * SESSION_TTL_DAYS
  });
}

async function issueSession(fastify, reply, user, env = process.env) {
  const token = await createSession(fastify.prisma, user, env);
  setSessionCookie(reply, token, env);
}

module.exports = { issueSession, createSession, setSessionCookie };
