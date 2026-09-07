import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import authPlugin from '../src/plugins/auth.js';
import publicAppGate from '../src/lib/publicAppGate.js';
import sessionResolver from '../src/lib/sessionResolver.js';
import optionalAuth from '../src/lib/optionalAuth.js';
import session from '../src/lib/session.js';
import buildServer from '../src/index.js';

const { resolveAuthenticatedSession } = sessionResolver;
const { optionalAuthenticatedUserId } = optionalAuth;
const { hashToken } = session;
let app;
let user;
let storedSession;
let token;
let prisma;
const env = {};

beforeEach(() => {
  for (const key of ['JWT_SECRET', 'COOKIE_SECRET', 'PUBLIC_APP_ENABLED']) env[key] = process.env[key];
  process.env.JWT_SECRET = 'canonical-session-test-secret-at-least-32-characters';
  process.env.COOKIE_SECRET = 'canonical-cookie-test-secret-at-least-32-characters';
  process.env.PUBLIC_APP_ENABLED = 'false';
  user = { id: 'user-1', role: 'ADMIN', status: 'ACTIVE', passwordHash: 'must-not-leak' };
  token = jwt.sign({ userId: user.id, sid: 'session-1', role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  storedSession = { id: 'session-1', userId: user.id, token: hashToken(token), expiresAt: new Date(Date.now() + 3600000) };
  prisma = {
    session: { findUnique: vi.fn(async () => storedSession) },
    user: { findUnique: vi.fn(async () => user) }
  };
});
afterEach(async () => {
  if (app) await app.close();
  app = null;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

async function gateApp() {
  app = Fastify();
  app.decorate('prisma', prisma);
  app.register(authPlugin);
  app.register(publicAppGate);
  app.register(async (routes) => {
    // A stale upstream decoration must never act as proof of authentication.
    routes.addHook('preValidation', async (request) => { request.user = { id: 'forged', role: 'ADMIN' }; });
    routes.get('/api/tracks', async () => ({ catalog: true }));
    routes.get('/api/administer', async () => ({ unexpected: true }));
    routes.get('/api/ready/private', async () => ({ unexpected: true }));
    routes.get('/api/tracks/showcase/private', async () => ({ unexpected: true }));
    routes.get('/api/ready', async () => ({ ready: true }));
    routes.get('/api/landing/showcase', async () => ({ tracks: [] }));
    routes.get('/api/auth/me', { preHandler: routes.authenticate }, async (request) => ({ user: request.user }));
    routes.get('/api/admin/overview', { preHandler: [routes.authenticate, routes.requireAdmin] }, async () => ({ admin: true }));
  });
  await app.ready();
  return app;
}
const cookie = () => ({ cookie: `token=${token}` });
const request = () => ({ cookies: { token }, user: { role: 'ADMIN' } });

const invalidCases = [
  ['revoked', () => { storedSession = null; }],
  ['expired stored session', () => { storedSession.expiresAt = new Date(Date.now() - 1); }],
  ['invalid stored expiry', () => { storedSession.expiresAt = new Date('invalid'); }],
  ['mismatched session owner', () => { storedSession.userId = 'other-user'; }],
  ['mismatched token hash', () => { storedSession.token = hashToken('other-token'); }],
  ['deleted user row', () => { user = null; }],
  ...['SUSPENDED', 'BANNED', 'DELETED'].map(status => [status, () => { user.status = status; }]),
  ['expired JWT', () => { token = jwt.sign({ userId: 'user-1', sid: 'session-1' }, process.env.JWT_SECRET, { expiresIn: -1 }); storedSession.token = hashToken(token); }],
  ['JWT without sid', () => { token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET, { expiresIn: '1h' }); storedSession.token = hashToken(token); }],
  ['JWT without expiry', () => { token = jwt.sign({ userId: 'user-1', sid: 'session-1' }, process.env.JWT_SECRET); storedSession.token = hashToken(token); }],
  ['tampered JWT', () => { token += 'bad'; }],
  ['unexpected JWT algorithm', () => { token = jwt.sign({ userId: 'user-1', sid: 'session-1' }, process.env.JWT_SECRET, { expiresIn: '1h', algorithm: 'HS384' }); storedSession.token = hashToken(token); }],
  ['session store unavailable', () => { prisma.session.findUnique.mockRejectedValue(new Error('offline')); }]
];

describe('canonical session and closed-mode authentication', () => {
  it('allows a current active admin with a stored matching session and excludes password hashes', async () => {
    expect(await resolveAuthenticatedSession({ prisma }, request())).toEqual({ user: { id: 'user-1', role: 'ADMIN', status: 'ACTIVE' }, sessionId: 'session-1' });
    expect(await optionalAuthenticatedUserId({ prisma }, request())).toBe('user-1');
    await gateApp();
    for (const url of ['/api/tracks', '/api/auth/me', '/api/admin/overview']) {
      expect((await app.inject({ url, headers: cookie() })).statusCode).toBe(200);
    }
  });

  it.each(invalidCases)('rejects %s consistently despite stale request.user', async (_label, invalidate) => {
    invalidate();
    expect(await resolveAuthenticatedSession({ prisma }, request())).toBeNull();
    expect(await optionalAuthenticatedUserId({ prisma }, request())).toBeNull();
    await gateApp();
    expect((await app.inject({ url: '/api/tracks', headers: cookie() })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/auth/me', headers: cookie() })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/admin/overview', headers: cookie() })).statusCode).toBe(401);
  });

  it.each(['LISTENER', 'ARTIST'])('uses the current %s role, ignoring a JWT admin claim', async role => {
    user.role = role;
    await gateApp();
    expect((await app.inject({ url: '/api/auth/me', headers: cookie() })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/tracks', headers: cookie() })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/admin/overview', headers: cookie() })).statusCode).toBe(403);
  });

  it('does not cache privilege across revocation or role changes between requests', async () => {
    await gateApp();
    expect((await app.inject({ url: '/api/tracks', headers: cookie() })).statusCode).toBe(200);
    user.role = 'LISTENER';
    expect((await app.inject({ url: '/api/tracks', headers: cookie() })).statusCode).toBe(403);
    user.role = 'ADMIN';
    storedSession = null;
    expect((await app.inject({ url: '/api/tracks', headers: cookie() })).statusCode).toBe(403);
  });

  it('matches exact API namespace boundaries and leaves unknown landing routes as 404', async () => {
    await gateApp();
    for (const url of ['/api/administer', '/api/ready/private', '/api/tracks/showcase/private']) {
      expect((await app.inject({ url })).statusCode).toBe(403);
    }
    expect((await app.inject({ url: '/api/ready?check=1' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/landing/showcase' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/landing/unknown' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/tracks' })).statusCode).toBe(403);
  });

  it('opens public application routes when enabled while preserving authenticated route checks', async () => {
    process.env.PUBLIC_APP_ENABLED = 'true';
    storedSession = null;
    await gateApp();
    expect((await app.inject({ url: '/api/tracks', headers: cookie() })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/auth/me', headers: cookie() })).statusCode).toBe(401);
  });

  it('blocks revoked sessions on actual upload, playlists, stats, admin, stream and discovery route registrations', async () => {
    storedSession = null;
    app = buildServer({ prisma, storage: {}, audioQueue: { add: vi.fn() }, rateLimitRedis: null });
    await app.ready();
    const routes = [
      ['GET', '/api/auth/me'], ['GET', '/api/tracks'], ['GET', '/api/tracks/test/stream'],
      ['GET', '/api/artists'], ['GET', '/api/discover/catalog'], ['GET', '/api/me/listening-stats'], ['GET', '/api/admin/creators'],
      ['POST', '/api/uploads/track/init'], ['POST', '/api/playlists'],
      ['POST', '/api/tracks/test/play-event']
    ];
    for (const [method, url] of routes) {
      const response = await app.inject({ method, url, headers: cookie(), ...(method === 'POST' ? { payload: {} } : {}) });
      expect([401, 403], `${method} ${url}: ${response.body}`).toContain(response.statusCode);
    }
  });
});
