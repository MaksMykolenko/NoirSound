const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { getAllowedOrigins } = require('../config');
const { issueSession } = require('../lib/authSession');
const {
  oauthConfig,
  safeReturnTo,
  secureEqual,
  uniqueUsername
} = require('../lib/googleOAuth');
const { scaledRateLimitMax } = require('../lib/rateLimit');

const COOKIE_TTL_SECONDS = 10 * 60;
const COOKIE_PATH = '/api/auth/google/callback';
const STATE_COOKIE = 'google_oauth_state';
const NONCE_COOKIE = 'google_oauth_nonce';
const VERIFIER_COOKIE = 'google_oauth_verifier';
const RETURN_TO_COOKIE = 'google_oauth_return_to';

function randomValue(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function cookieOptions() {
  return {
    path: COOKIE_PATH,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    signed: true,
    maxAge: COOKIE_TTL_SECONDS
  };
}

function readSignedCookie(request, name) {
  const raw = request.cookies[name];
  if (!raw) return null;
  const result = request.unsignCookie(raw);
  return result.valid ? result.value : null;
}

function clearOAuthCookies(reply) {
  for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE, RETURN_TO_COOKIE]) {
    reply.clearCookie(name, { path: COOKIE_PATH });
  }
}

function frontendRedirect(reply, result, reason, returnTo = '/') {
  const frontendOrigin = getAllowedOrigins(process.env)[0];
  const target = new URL(safeReturnTo(returnTo), frontendOrigin);
  target.searchParams.set('auth', result);
  if (reason) target.searchParams.set('reason', reason);
  return reply.redirect(target.toString());
}

async function resolveGoogleUser(prisma, profile) {
  const providerAccountId = profile.sub;
  const email = profile.email.trim().toLowerCase();

  const resolve = async (tx) => {
    const linkedAccount = await tx.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'GOOGLE',
          providerAccountId
        }
      },
      include: { user: true }
    });
    if (linkedAccount) return linkedAccount.user;

    let user = await tx.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (user && user.status !== 'ACTIVE') return user;

    if (!user) {
      const username = await uniqueUsername(tx, {
        email,
        name: profile.name
      });
      const displayName = profile.name?.trim().slice(0, 80) || email.split('@')[0];
      const avatarUrl = profile.picture?.startsWith('https://') ? profile.picture : null;
      user = await tx.user.create({
        data: {
          email,
          passwordHash: null,
          username,
          displayName,
          avatarUrl
        }
      });
    }

    await tx.oAuthAccount.create({
      data: {
        provider: 'GOOGLE',
        providerAccountId,
        providerEmail: email,
        userId: user.id
      }
    });
    return user;
  };

  try {
    return await prisma.$transaction(resolve);
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const linkedAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'GOOGLE',
          providerAccountId
        }
      },
      include: { user: true }
    });
    if (linkedAccount) return linkedAccount.user;
    throw error;
  }
}

async function googleAuthRoutes(fastify, options) {
  const createClient = options.googleOAuthClientFactory || ((config) =>
    new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri));

  fastify.get('/google', {
    config: {
      rateLimit: {
        max: scaledRateLimitMax(30),
        timeWindow: '15 minutes'
      }
    }
  }, async (request, reply) => {
    const config = oauthConfig();
    const returnTo = safeReturnTo(request.query?.returnTo);
    if (!config.enabled) {
      return frontendRedirect(reply, 'google_error', 'not_configured', returnTo);
    }

    const state = randomValue();
    const nonce = randomValue();
    const verifier = randomValue(64);
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const options = cookieOptions();

    reply.setCookie(STATE_COOKIE, state, options);
    reply.setCookie(NONCE_COOKIE, nonce, options);
    reply.setCookie(VERIFIER_COOKIE, verifier, options);
    reply.setCookie(RETURN_TO_COOKIE, returnTo, options);

    const authorizationUrl = createClient(config).generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });
    return reply.redirect(authorizationUrl);
  });

  fastify.get('/google/callback', {
    config: {
      rateLimit: {
        max: scaledRateLimitMax(30),
        timeWindow: '15 minutes'
      }
    }
  }, async (request, reply) => {
    const returnTo = readSignedCookie(request, RETURN_TO_COOKIE) || '/';
    const expectedState = readSignedCookie(request, STATE_COOKIE);
    const expectedNonce = readSignedCookie(request, NONCE_COOKIE);
    const verifier = readSignedCookie(request, VERIFIER_COOKIE);
    clearOAuthCookies(reply);

    if (!expectedState || !secureEqual(request.query?.state, expectedState)) {
      return frontendRedirect(reply, 'google_error', 'invalid_state', returnTo);
    }
    if (request.query?.error) {
      const reason = request.query.error === 'access_denied' ? 'access_denied' : 'provider_error';
      return frontendRedirect(reply, 'google_error', reason, returnTo);
    }
    if (!request.query?.code || !expectedNonce || !verifier) {
      return frontendRedirect(reply, 'google_error', 'invalid_callback', returnTo);
    }

    const config = oauthConfig();
    if (!config.enabled) {
      return frontendRedirect(reply, 'google_error', 'not_configured', returnTo);
    }

    try {
      const client = createClient(config);
      const { tokens } = await client.getToken({
        code: request.query.code,
        codeVerifier: verifier,
        redirect_uri: config.redirectUri
      });
      if (!tokens.id_token) {
        return frontendRedirect(reply, 'google_error', 'missing_identity', returnTo);
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.clientId
      });
      const profile = ticket.getPayload();

      if (
        !profile?.sub ||
        !profile.email ||
        profile.email_verified !== true ||
        !secureEqual(profile.nonce, expectedNonce)
      ) {
        return frontendRedirect(reply, 'google_error', 'unverified_identity', returnTo);
      }

      const user = await resolveGoogleUser(fastify.prisma, profile);
      if (!user || user.status !== 'ACTIVE') {
        return frontendRedirect(reply, 'google_error', 'account_inactive', returnTo);
      }

      await issueSession(fastify, reply, user);
      return frontendRedirect(reply, 'google_success', null, returnTo);
    } catch (error) {
      fastify.log.warn({
        errorName: error?.name,
        errorCode: error?.code
      }, 'Google OAuth callback failed');
      return frontendRedirect(reply, 'google_error', 'provider_error', returnTo);
    }
  });
}

module.exports = googleAuthRoutes;
module.exports.resolveGoogleUser = resolveGoogleUser;
