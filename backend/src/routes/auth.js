const argon2 = require('argon2');
const { issueSession } = require('../lib/authSession');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const { evaluateUploadAccess, ensureArtistProfile } = require('../lib/artistAccess');
const { auditData, createAudit } = require('../lib/auditLog');

function withArtistAccess(user, artistProfile) {
  return {
    ...user,
    artistProfileId: artistProfile?.id || null,
    hasArtistProfile: Boolean(artistProfile),
    artistProfileHidden: artistProfile?.isHidden || false,
    ...evaluateUploadAccess({ role: user.role, status: user.status, artistProfile })
  };
}

async function authRoutes(fastify, _options) {
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
      await issueSession(fastify, reply, user);

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

      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isMatch = await argon2.verify(user.passwordHash, password);
      if (!isMatch || user.status !== 'ACTIVE') {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      await issueSession(fastify, reply, user);

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
      select: { id: true, isHidden: true }
    });
    return { user: withArtistAccess(request.user, artistProfile) };
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
        select: { id: true, isHidden: true }
      });

      const { passwordHash: _, ...safeUser } = updatedUser;
      return { user: withArtistAccess(safeUser, artistProfile) };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/auth/me/ensure-artist-profile — narrow self-service: an ADMIN
  // may create their own artist profile without going through the admin
  // console. This grants no new privilege — admins already get a profile
  // auto-created the first time they use /uploads/track/init; this exposes
  // that same, already-trusted behavior as an explicit, friendly action from
  // the Upload page instead of a silent side effect. Never available to
  // non-admins, and it can only ever act on the caller's own account.
  fastify.post('/me/ensure-artist-profile', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(10), timeWindow: '1 hour', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({
        error: 'ADMIN_ONLY',
        message: 'Only administrators can self-create an artist profile. Ask an admin to grant artist access.'
      });
    }
    const ensured = await ensureArtistProfile(fastify.prisma, request.user.id);
    if (ensured.created) {
      await createAudit(fastify.prisma, auditData(
        request.user.id,
        'ARTIST_PROFILE_CREATED',
        'ARTIST',
        ensured.profile.id,
        'Self-service artist profile creation by admin.',
        { userId: request.user.id, triggeredBy: 'SELF_SERVICE' }
      ));
    }
    return { user: withArtistAccess(request.user, ensured.profile), created: ensured.created };
  });
}

module.exports = authRoutes;
