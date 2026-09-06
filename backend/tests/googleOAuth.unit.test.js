import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeReturnTo } from '../src/lib/googleOAuth';
import googleAuthRoutes from '../src/routes/googleAuth';

const origin = 'https://noirsound.example.invalid';
const hostilePaths = ['/\n/redirect.example.invalid', '/\r/redirect.example.invalid', '/\t/redirect.example.invalid'];

describe('OAuth return URL normalization', () => {
  it.each(hostilePaths)('keeps control-character URL input %j on the allowed origin', input => {
    // Prove this input would otherwise resolve off-origin under WHATWG URL.
    expect(new URL(input, origin).origin).not.toBe(origin);
    const safe = safeReturnTo(input);
    expect(safe).toBe('/');
    expect(new URL(safe, origin).origin).toBe(origin);
  });

  it('rejects every ASCII control character instead of silently normalizing an upload intent', () => {
    for (const code of [...Array.from({ length: 32 }, (_, index) => index), 127]) {
      expect(safeReturnTo(`/upload?intent=${String.fromCharCode(code)}draft`)).toBe('/');
    }
  });

  it.each([
    '/upload?landingDraft=1', '/upload/batch', '/discover?content=BEAT&q=%D0%91%D1%96%D1%82',
    '/profile?tab=settings#credits', '/?auth=google_success&continue=%2Fupload'
  ])('preserves supported path, query, and hash without changing their contract: %s', input => {
    expect(safeReturnTo(input)).toBe(input);
    expect(new URL(safeReturnTo(input), origin).origin).toBe(origin);
  });
});

describe('OAuth HTTP return URL boundaries', () => {
  let app;
  beforeEach(async () => {
    vi.stubEnv('FRONTEND_ORIGIN', origin);
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    vi.stubEnv('GOOGLE_REDIRECT_URI', '');
    app = Fastify();
    await app.register(cookie, { secret: randomBytes(32).toString('hex') });
    await app.register(googleAuthRoutes, { prefix: '/api/auth' });
    await app.ready();
  });
  afterEach(async () => { await app.close(); vi.unstubAllEnvs(); });

  it.each(hostilePaths)('prevents external redirects through the public OAuth start endpoint: %j', async input => {
    const response = await app.inject(`/api/auth/google?${new URLSearchParams({ returnTo: input })}`);
    expect(response.statusCode).toBe(302);
    const target = new URL(response.headers.location);
    expect(target.origin).toBe(origin);
    expect(target.pathname).toBe('/');
    expect(target.searchParams.get('reason')).toBe('not_configured');
  });

  it('revalidates a previously signed return cookie at the OAuth callback boundary', async () => {
    const signed = encodeURIComponent(app.signCookie(hostilePaths[0]));
    const response = await app.inject({
      url: '/api/auth/google/callback?state=expired',
      headers: { cookie: `google_oauth_return_to=${signed}` }
    });
    expect(response.statusCode).toBe(302);
    const target = new URL(response.headers.location);
    expect(target.origin).toBe(origin);
    expect(target.pathname).toBe('/');
    expect(target.searchParams.get('reason')).toBe('invalid_state');
  });

  it('preserves the valid upload intent on an OAuth configuration error', async () => {
    const response = await app.inject('/api/auth/google?returnTo=%2Fupload%3FlandingDraft%3D1');
    const target = new URL(response.headers.location);
    expect(response.statusCode).toBe(302);
    expect(target.origin).toBe(origin);
    expect(target.pathname).toBe('/upload');
    expect(target.searchParams.get('landingDraft')).toBe('1');
    expect(target.searchParams.get('auth')).toBe('google_error');
  });
});
