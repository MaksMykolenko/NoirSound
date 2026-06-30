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

  it('returns a request id header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});
