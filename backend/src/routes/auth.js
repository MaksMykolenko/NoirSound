const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const {
  hashToken,
  newSessionId,
  sessionExpiry,
  SESSION_TTL_DAYS
} = require('../lib/session');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');

async function authRoutes(fastify, _options) {

  // Issue a JWT bound to a revocable server-side session and set the cookie.
  async function issueSession(reply, user) {
    const sid = newSessionId();
    const token = jwt.sign({ userId: user.id, sid }, process.env.JWT_SECRET, {
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * SESSION_TTL_DAYS
    });
  }

  // POST /api/auth/register
  fastify.post('/register', {
    config: {
      rateLimit: {
        max: scaledRateLimitMax(10),
        timeWindow: '1 hour'
      }
    }
  }, async (request, reply) => {
    const { email, password, username, displayName } = request.body;

    if (!email || !password || !username || !displayName) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      // Check if user exists
      const existingUser = await fastify.prisma.user.findFirst({
        where: { OR: [{ email }, { username }] }
      });
      
      if (existingUser) {
        return reply.status(400).send({ error: 'Email or username already in use' });
      }

      const passwordHash = await argon2.hash(password);

      const user = await fastify.prisma.user.create({
        data: {
          email,
          username,
          displayName,
          passwordHash,
          avatarUrl: null
        }
      });

      // Issue a revocable session + JWT cookie
      await issueSession(reply, user);

      // don't send password hash back
      const { passwordHash: _, ...safeUser } = user;

      return { message: 'Registered successfully', user: safeUser };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/auth/login
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: scaledRateLimitMax(5),
        timeWindow: '15 minutes'
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Missing email or password' });
    }

    try {
      const user = await fastify.prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isMatch = await argon2.verify(user.passwordHash, password);
      if (!isMatch || user.status !== 'ACTIVE') {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      await issueSession(reply, user);

      const { passwordHash: _, ...safeUser } = user;
      return { user: safeUser };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/auth/logout — revokes the current session server-side
  fastify.post('/logout', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    if (request.sessionId) {
      await fastify.prisma.session.deleteMany({ where: { id: request.sessionId } });
    }
    reply.clearCookie('token', { path: '/' });
    return { message: 'Logged out successfully' };
  });

  // POST /api/auth/logout-all — revokes every session for the user
  fastify.post('/logout-all', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const result = await fastify.prisma.session.deleteMany({
      where: { userId: request.user.id }
    });
    reply.clearCookie('token', { path: '/' });
    return { message: 'All sessions revoked', revoked: result.count };
  });

  // GET /api/auth/me
  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request) => {
    const artistProfile = await fastify.prisma.artistProfile.findUnique({
      where: { userId: request.user.id },
      select: { id: true }
    });
    return {
      user: {
        ...request.user,
        artistProfileId: artistProfile?.id || null
      }
    };
  });

  // PUT /api/auth/me
  fastify.put('/me', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(30), timeWindow: '1 hour', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    const { displayName, username, bio, location, avatarUrl, bannerUrl, preferredLanguage } = request.body || {};

    try {
      const updateData = {};
      if (displayName !== undefined) updateData.displayName = displayName.trim();
      if (bio !== undefined) updateData.bio = bio ? bio.trim() : null;
      if (location !== undefined) updateData.location = location ? location.trim() : null;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
      if (bannerUrl !== undefined) updateData.bannerUrl = bannerUrl;
      if (preferredLanguage !== undefined) {
        const allowed = ['en', 'uk', 'pl', 'ru'];
        if (allowed.includes(preferredLanguage)) {
          updateData.preferredLanguage = preferredLanguage;
        }
      }

      if (username !== undefined && username.trim() !== request.user.username) {
        const cleanUsername = username.trim();
        const existing = await fastify.prisma.user.findUnique({
          where: { username: cleanUsername }
        });
        if (existing && existing.id !== request.user.id) {
          return reply.status(400).send({ error: 'Username is already taken' });
        }
        updateData.username = cleanUsername;
      }

      const updatedUser = await fastify.prisma.user.update({
        where: { id: request.user.id },
        data: updateData
      });

      const artistProfile = await fastify.prisma.artistProfile.findUnique({
        where: { userId: updatedUser.id },
        select: { id: true }
      });

      const { passwordHash: _, ...safeUser } = updatedUser;
      return {
        user: {
          ...safeUser,
          artistProfileId: artistProfile?.id || null
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = authRoutes;
