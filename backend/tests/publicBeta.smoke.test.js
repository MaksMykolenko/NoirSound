/**
 * Public Beta sprint — server wiring smoke test (no database needed).
 * The Prisma plugin degrades gracefully when Postgres is absent, so we can
 * assert plugin/route/security wiring with fastify.inject (no network).
 *
 * Runnable with: npx vitest run tests/publicBeta.smoke.test.js
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import buildServer from '../src/index.js';

describe('server wiring (no DB)', () => {
  let app;

  beforeAll(async () => {
    const storage = {
      createPresignedPutUrl: vi.fn(), createPresignedGetUrl: vi.fn(),
      getPublicOrSignedUrl: vi.fn(), getObjectMetadata: vi.fn()
    };
    const audioQueue = { add: vi.fn(), on: vi.fn(), close: vi.fn() };
    app = buildServer({ storage, audioQueue, rateLimitRedis: null });
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('serves /api/health with security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('serves a redaction-safe real API mode endpoint', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/mode' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ apiMode: 'real', mock: false });
    expect(JSON.stringify(res.json())).not.toMatch(/secret|password|token/i);
  });

  it('reports not-ready when any required dependency is unavailable', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json().status).toBe('not-ready');
    expect(Object.values(res.json().checks)).toContain('unavailable');
  });

  it('blocks a credentialed cross-origin POST (CSRF)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: 'token=forged', origin: 'https://evil.example' }
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('CSRF_VALIDATION_FAILED');
  });

  it('allows a same-origin POST past CSRF (then 401 without a valid session)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: 'token=forged', origin: 'http://localhost:5173' }
    });
    // CSRF passed; authentication then fails on the forged token.
    expect(res.statusCode).toBe(401);
  });

  it('exposes admin routes that require authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/reports' });
    expect(res.statusCode).toBe(401); // route exists, auth required
  });

  it('redirects Google login back with a configuration error when OAuth is disabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/google?returnTo=%2Flibrary'
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(
      'http://localhost:5173/library?auth=google_error&reason=not_configured'
    );
  });

  it('starts Google OAuth with state, nonce, PKCE, and signed short-lived cookies', async () => {
    const previous = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    };
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/google?returnTo=%2Fdiscover%3Fgenre%3Dambient'
      });
      expect(res.statusCode).toBe(302);
      const location = new URL(res.headers.location);
      expect(location.origin).toBe('https://accounts.google.com');
      expect(location.searchParams.get('client_id')).toBe(process.env.GOOGLE_CLIENT_ID);
      expect(location.searchParams.get('redirect_uri')).toBe(process.env.GOOGLE_REDIRECT_URI);
      expect(location.searchParams.get('state')).toBeTruthy();
      expect(location.searchParams.get('nonce')).toBeTruthy();
      expect(location.searchParams.get('code_challenge')).toBeTruthy();
      expect(location.searchParams.get('code_challenge_method')).toBe('S256');
      expect(res.headers.location).not.toContain(process.env.GOOGLE_CLIENT_SECRET);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toHaveLength(4);
      expect(cookies.every((cookie) => cookie.includes('HttpOnly'))).toBe(true);
      expect(cookies.every((cookie) => cookie.includes('SameSite=Lax'))).toBe(true);
      expect(cookies.every((cookie) => cookie.includes('Max-Age=600'))).toBe(true);
    } finally {
      if (previous.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previous.clientId;
      if (previous.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previous.clientSecret;
      if (previous.redirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI;
      else process.env.GOOGLE_REDIRECT_URI = previous.redirectUri;
    }
  });

  it('returns a request id header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});

describe('Google OAuth callback', () => {
  it('creates an OAuth user and issues the standard NoirSound session', async () => {
    const previous = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    };
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

    let authorizationOptions;
    const googleClient = {
      generateAuthUrl: vi.fn((options) => {
        authorizationOptions = options;
        return 'https://accounts.google.com/o/oauth2/v2/auth';
      }),
      getToken: vi.fn(async () => ({ tokens: { id_token: 'verified-id-token' } })),
      verifyIdToken: vi.fn(async () => ({
        getPayload: () => ({
          sub: 'google-account-123',
          email: 'listener@example.com',
          email_verified: true,
          name: 'New Listener',
          picture: 'https://example.com/avatar.png',
          nonce: authorizationOptions.nonce
        })
      }))
    };
    const createdUser = {
      id: 'user-google-1',
      email: 'listener@example.com',
      passwordHash: null,
      username: 'listener',
      displayName: 'New Listener',
      avatarUrl: 'https://example.com/avatar.png',
      role: 'LISTENER',
      status: 'ACTIVE'
    };
    const tx = {
      oAuthAccount: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: 'oauth-1' }))
      },
      user: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => createdUser)
      }
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
      session: { create: vi.fn(async () => ({ id: 'session-1' })) }
    };
    const storage = {
      createPresignedPutUrl: vi.fn(),
      createPresignedGetUrl: vi.fn(),
      getPublicOrSignedUrl: vi.fn(),
      getObjectMetadata: vi.fn()
    };
    const audioQueue = { add: vi.fn(), on: vi.fn(), close: vi.fn() };
    const oauthApp = buildServer({
      storage,
      audioQueue,
      rateLimitRedis: null,
      prisma,
      googleOAuthClientFactory: () => googleClient
    });

    try {
      await oauthApp.ready();
      const start = await oauthApp.inject({
        method: 'GET',
        url: '/api/auth/google?returnTo=%2Flibrary'
      });
      const cookieHeader = start.headers['set-cookie']
        .map((cookie) => cookie.split(';')[0])
        .join('; ');

      const callback = await oauthApp.inject({
        method: 'GET',
        url: `/api/auth/google/callback?code=test-code&state=${encodeURIComponent(authorizationOptions.state)}`,
        headers: { cookie: cookieHeader }
      });

      expect(callback.statusCode).toBe(302);
      expect(callback.headers.location).toBe(
        'http://localhost:5173/library?auth=google_success'
      );
      expect(googleClient.getToken).toHaveBeenCalledWith(expect.objectContaining({
        code: 'test-code',
        codeVerifier: expect.any(String)
      }));
      expect(googleClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: 'verified-id-token',
        audience: process.env.GOOGLE_CLIENT_ID
      });
      expect(tx.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'listener@example.com',
          passwordHash: null,
          username: 'listener'
        })
      });
      expect(tx.oAuthAccount.create).toHaveBeenCalledWith({
        data: {
          provider: 'GOOGLE',
          providerAccountId: 'google-account-123',
          providerEmail: 'listener@example.com',
          userId: 'user-google-1'
        }
      });
      expect(prisma.session.create).toHaveBeenCalledOnce();
      expect(callback.headers['set-cookie'].some((cookie) =>
        cookie.startsWith('token=') && cookie.includes('HttpOnly')
      )).toBe(true);
    } finally {
      await oauthApp.close();
      if (previous.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previous.clientId;
      if (previous.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previous.clientSecret;
      if (previous.redirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI;
      else process.env.GOOGLE_REDIRECT_URI = previous.redirectUri;
    }
  });
});
