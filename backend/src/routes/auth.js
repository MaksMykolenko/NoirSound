const argon2 = require('argon2');
const { issueSession, createSession, setSessionCookie } = require('../lib/authSession');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const { evaluateUploadAccess, ensureArtistProfile } = require('../lib/artistAccess');
const { auditData, createAudit } = require('../lib/auditLog');
const { RegistrationValidationError, validateRegistration, validateCreatorInput } = require('../lib/registrationValidation');
const { creatorSelfView, CREATOR_SELF_SELECT } = require('../lib/creatorViews');
const {
  MAX_BANNER_BYTES,
  ProfileMediaError,
  bannerKeyFromUploadId,
  completeBannerReplacement,
  createBannerUploadId,
  normalizeBio,
  pendingBannerKeyFromUploadId,
  removeProfileBanner,
  serializeUserMedia,
  validateBannerInit
} = require('../lib/profileMedia');

function withArtistAccess(user, artistProfile) {
  return {
    ...user,
    artistProfileId: artistProfile?.id || null,
    hasArtistProfile: Boolean(artistProfile),
    artistProfileHidden: artistProfile?.isHidden || false,
    ...evaluateUploadAccess({ role: user.role, status: user.status, artistProfile })
  };
}

async function safeSerializedUser(fastify, user) {
  const fields = ['id', 'email', 'username', 'displayName', 'avatarUrl', 'bannerUrl', 'bio',
    'location', 'preferredLanguage', 'role', 'status', 'joinedAt', 'updatedAt',
    'discordPresenceEnabled', 'discordPresenceShowCover', 'discordPresenceShowTimer'];
  const safeUser = Object.fromEntries(fields.filter((field) => user[field] !== undefined)
    .map((field) => [field, user[field]]));
  return serializeUserMedia(fastify.storage, safeUser);
}

async function serializedUserWithArtistAccess(fastify, user, knownArtistProfile) {
  const [artistProfile, creatorRegistration] = await Promise.all([
    knownArtistProfile === undefined
      ? fastify.prisma.artistProfile.findUnique({
          where: { userId: user.id },
          select: { id: true, isHidden: true }
        })
      : knownArtistProfile,
    fastify.prisma.creatorRegistration
      ? fastify.prisma.creatorRegistration.findUnique({
          where: { userId: user.id },
          select: CREATOR_SELF_SELECT
        })
      : Promise.resolve(null)
  ]);
  const serialized = withArtistAccess(await safeSerializedUser(fastify, user), artistProfile);
  return {
    ...serialized,
    creatorRegistration: creatorSelfView(creatorRegistration)
  };
}

function sendProfileMediaError(fastify, reply, error, fallbackMessage) {
  if (error instanceof ProfileMediaError) {
    return reply.status(error.statusCode).send({ error: error.code, message: error.message });
  }
  fastify.log.error(error);
  return reply.status(500).send({ error: 'PROFILE_UPDATE_FAILED', message: fallbackMessage });
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
    try {
      const input = validateRegistration(request.body);
      const existingUser = await fastify.prisma.user.findFirst({
        where: { OR: [
          { email: { equals: input.email, mode: 'insensitive' } },
          { username: { equals: input.username, mode: 'insensitive' } }
        ] }
      });
      if (existingUser) {
        const emailExists = existingUser.email.toLowerCase() === input.email;
        return reply.status(409).send({
          error: emailExists ? 'REGISTER_EMAIL_EXISTS' : 'REGISTER_USERNAME_EXISTS',
          message: emailExists ? 'Email is already in use.' : 'Username is already in use.'
        });
      }
      const passwordHash = await argon2.hash(input.password);
      // User, prepared profile, creator registration, audit and session either
      // persist together or roll back; an invalid creator never leaves an account.
      const { user, token } = await fastify.prisma.$transaction(async (client) => {
        const user = await client.user.create({ data: {
          email: input.email, username: input.username, displayName: input.displayName,
          passwordHash, avatarUrl: null, role: 'LISTENER'
        } });
        if (input.creator) {
          await ensureArtistProfile(client, user.id);
          await client.creatorRegistration.create({ data: {
            userId: user.id, ...input.creator, status: 'REGISTERED'
          } });
          await createAudit(client, {
            actorId: user.id, action: 'CREATOR_REGISTERED', targetType: 'USER', targetId: user.id,
            metadata: { creatorType: input.creator.creatorType,
              intendsMusic: input.creator.intendsMusic, intendsBeats: input.creator.intendsBeats }
          });
        }
        return { user, token: await createSession(client, user) };
      });
      setSessionCookie(reply, token);
      return { message: 'Registered successfully', user: await serializedUserWithArtistAccess(fastify, user) };
    } catch (error) {
      if (error instanceof RegistrationValidationError) {
        return reply.status(400).send({ error: error.code, message: error.message });
      }
      // A concurrent registration may win after the initial uniqueness check.
      if (error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : [String(error.meta?.target || '')];
        const emailExists = target.some((field) => field.includes('email'));
        if (emailExists || target.some((field) => field.includes('username'))) {
          return reply.status(409).send({
            error: emailExists ? 'REGISTER_EMAIL_EXISTS' : 'REGISTER_USERNAME_EXISTS',
            message: emailExists ? 'Email is already in use.' : 'Username is already in use.'
          });
        }
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/auth/creator-onboarding
  fastify.post('/creator-onboarding', {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: scaledRateLimitMax(10), timeWindow: '1 hour', keyGenerator: userOrIpKey } }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const creator = validateCreatorInput(request.body || {}, request.user.displayName || request.user.username);
      const registration = await fastify.prisma.$transaction(async (client) => {
        await ensureArtistProfile(client, userId);
        const registration = await client.creatorRegistration.upsert({
          where: { userId },
          create: { userId, ...creator, status: 'REGISTERED' },
          update: creator
        });
        await createAudit(client, {
          actorId: userId, action: 'CREATOR_REGISTERED', targetType: 'USER', targetId: userId,
          metadata: { creatorType: creator.creatorType, intendsMusic: creator.intendsMusic, intendsBeats: creator.intendsBeats }
        });
        return registration;
      });
      const updatedUser = await fastify.prisma.user.findUnique({ where: { id: userId } });
      return {
        message: 'Creator profile registered successfully',
        user: await serializedUserWithArtistAccess(fastify, updatedUser),
        creatorRegistration: creatorSelfView(registration)
      };
    } catch (error) {
      if (error instanceof RegistrationValidationError) {
        return reply.status(400).send({ error: error.code, message: error.message });
      }
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
    const { email, password } = request.body || {};

    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return reply.status(400).send({ error: 'Missing email or password' });
    }

    try {
      const user = await fastify.prisma.user.findFirst({
        where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } }
      });

      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isMatch = await argon2.verify(user.passwordHash, password);
      if (!isMatch || user.status !== 'ACTIVE') {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      await issueSession(fastify, reply, user);

      return { user: await safeSerializedUser(fastify, user) };
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
    return { user: await serializedUserWithArtistAccess(fastify, request.user) };
  });

  // PUT /api/auth/me
  fastify.put('/me', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(30), timeWindow: '1 hour', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    const body = request.body || {};
    if (Object.prototype.hasOwnProperty.call(body, 'bannerUrl')) {
      return reply.status(400).send({
        error: 'PROFILE_MEDIA_DIRECT_WRITE_FORBIDDEN',
        message: 'Profile media must be changed through the managed upload endpoints.'
      });
    }
    const { displayName, username, bio, location, avatarUrl, preferredLanguage } = body;

    try {
      const updateData = {};
      if (displayName !== undefined) updateData.displayName = displayName.trim();
      if (bio !== undefined) {
        const normalizedBio = normalizeBio(bio);
        if (!normalizedBio.ok) {
          return reply.status(400).send({
            error: 'PROFILE_BIO_INVALID',
            message: normalizedBio.message
          });
        }
        updateData.bio = normalizedBio.value;
      }
      if (location !== undefined) updateData.location = location ? location.trim() : null;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
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

      return { user: await serializedUserWithArtistAccess(fastify, updatedUser) };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/me/banner/init', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(10), timeWindow: '1 day', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    const validation = validateBannerInit(request.body);
    if (!validation.ok) {
      return reply.status(400).send({
        error: 'PROFILE_BANNER_INVALID',
        message: validation.message
      });
    }

    const uploadId = createBannerUploadId(validation.mimeType);
    const pendingBannerKey = pendingBannerKeyFromUploadId(request.user.id, uploadId);
    try {
      const uploadUrl = await fastify.storage.createPresignedPutUrl(
        pendingBannerKey,
        validation.mimeType,
        900,
        validation.fileSize
      );
      return {
        uploadId,
        uploadUrl,
        method: 'PUT',
        maxBytes: MAX_BANNER_BYTES
      };
    } catch (error) {
      fastify.log.error({ err: error, userId: request.user.id }, 'Profile banner upload initialization failed');
      return reply.status(502).send({
        error: 'PROFILE_BANNER_UPLOAD_FAILED',
        message: 'Banner upload could not be initialized.'
      });
    }
  });

  fastify.post('/me/banner/complete', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(30), timeWindow: '1 hour', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    const bannerKey = bannerKeyFromUploadId(request.user.id, request.body?.uploadId);
    const pendingBannerKey = pendingBannerKeyFromUploadId(request.user.id, request.body?.uploadId);
    if (!bannerKey || !pendingBannerKey) {
      return reply.status(400).send({
        error: 'PROFILE_BANNER_INVALID',
        message: 'Banner upload id is invalid.'
      });
    }
    try {
      const updatedUser = await completeBannerReplacement({
        prisma: fastify.prisma,
        storage: fastify.storage,
        userId: request.user.id,
        pendingKey: pendingBannerKey,
        newKey: bannerKey,
        logger: fastify.log
      });
      return { user: await serializedUserWithArtistAccess(fastify, updatedUser) };
    } catch (error) {
      return sendProfileMediaError(fastify, reply, error, 'Banner upload could not be completed.');
    }
  });

  fastify.delete('/me/banner', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(20), timeWindow: '1 hour', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    try {
      const updatedUser = await removeProfileBanner({
        prisma: fastify.prisma,
        storage: fastify.storage,
        userId: request.user.id,
        logger: fastify.log
      });
      return { user: await serializedUserWithArtistAccess(fastify, updatedUser) };
    } catch (error) {
      return sendProfileMediaError(fastify, reply, error, 'Banner could not be removed.');
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
    return {
      user: await serializedUserWithArtistAccess(fastify, request.user, ensured.profile),
      created: ensured.created
    };
  });
}

module.exports = authRoutes;
