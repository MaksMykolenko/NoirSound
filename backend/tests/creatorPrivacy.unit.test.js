import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import authPlugin from '../src/plugins/auth.js';
import adminRoutes from '../src/routes/admin.js';
import views from '../src/lib/creatorViews.js';
import creators from '../src/lib/creators.js';
import session from '../src/lib/session.js';
const { creatorSelfView, creatorAdminView, creatorAdminSelect, creatorSearchConditions } = views;
const { formatCreatorsCsv } = creators;
const fixture = {
  id: 'registration-1', userId: 'creator-1', creatorType: 'BOTH', intendsMusic: true, intendsBeats: true,
  displayName: '=SUM(1,2)', portfolioUrl: 'https://example.test/creator', primaryPlatformUrl: null,
  note: 'My own creator note', status: 'REVIEWED', adminNote: 'Internal review note',
  reviewedAt: new Date('2026-01-01'), enabledAt: null, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
  futurePrivateColumn: 'future-secret', moderationMetadata: { private: 'internal' },
  user: { id: 'creator-1', username: 'creator_1', displayName: 'Creator One', email: 'private@example.test', role: 'LISTENER', status: 'ACTIVE', joinedAt: new Date('2026-01-01'), passwordHash: 'secret-hash', futurePrivateColumn: 'user-secret', artistProfile: { id: 'artist-1', isHidden: false, futurePrivateColumn: 'artist-secret' } }
};
let app;
let prisma;
let headers;
let role;
const env = {};
beforeEach(() => {
  for (const key of ['JWT_SECRET', 'COOKIE_SECRET']) env[key] = process.env[key];
  process.env.JWT_SECRET = 'creator-privacy-test-jwt-secret-at-least-32';
  process.env.COOKIE_SECRET = 'creator-privacy-test-cookie-secret-at-least-32';
  role = 'ADMIN';
  const token = jwt.sign({ userId: 'admin-1', sid: 'session-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  headers = { cookie: `token=${token}` };
  prisma = {
    user: { findUnique: vi.fn(async () => ({ id: 'admin-1', role, status: 'ACTIVE' })) },
    session: { findUnique: vi.fn(async () => ({ id: 'session-1', userId: 'admin-1', token: session.hashToken(token), expiresAt: new Date(Date.now() + 3600000) })) },
    creatorRegistration: {
      findMany: vi.fn(async () => [fixture]), count: vi.fn(async () => 1),
      groupBy: vi.fn(async () => [{ status: 'REVIEWED', _count: { status: 1 } }]),
      findFirst: vi.fn(async () => fixture), update: vi.fn(async ({ data }) => ({ ...fixture, ...data }))
    },
    auditLog: {
      create: vi.fn(async ({ data }) => data),
      findMany: vi.fn(async () => [{ id: 'audit-1', actorId: 'admin-1', action: 'CREATOR_STATUS_CHANGED', targetType: 'USER', targetId: 'creator-1', createdAt: new Date(), actor: { id: 'admin-1', username: 'admin', email: 'staff@example.test', passwordHash: 'secret-hash' }, metadata: { email: 'private@example.test', ip: '192.0.2.1', password: 'secret', nested: { email: 'nested@example.test' } }, futurePrivateColumn: 'audit-secret' }])
    }
  };
});
afterEach(async () => {
  if (app) await app.close();
  app = null;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
async function start() {
  app = Fastify(); app.decorate('prisma', prisma); app.register(authPlugin);
  app.register(adminRoutes, { prefix: '/api/admin' }); await app.ready();
}

describe('creator allowlist serializers', () => {
  it('never exposes staff fields, nested user data or future columns to creator self-service', () => {
    const view = creatorSelfView(fixture);
    expect(view).toEqual({ id: fixture.id, creatorType: 'BOTH', intendsMusic: true, intendsBeats: true, displayName: fixture.displayName,
      portfolioUrl: fixture.portfolioUrl, primaryPlatformUrl: null, note: fixture.note, createdAt: fixture.createdAt, updatedAt: fixture.updatedAt });
    expect(creatorSelfView(null)).toBeNull();
  });
  it('retains allowed staff fields while excluding future user/profile/registration secrets', () => {
    const view = creatorAdminView(fixture);
    expect(view.adminNote).toBe(fixture.adminNote);
    expect(view.userAccess.canUploadTracks).toBe(false);
    expect(JSON.stringify(view)).not.toMatch(/email|futurePrivateColumn|moderationMetadata|passwordHash/);
    expect(view.user.artistProfile).toEqual({ id: 'artist-1', isHidden: false });
  });
  it('supports the existing explicit pii.read decision for query, serializer, search and CSV', () => {
    const without = creatorAdminView(fixture, { includePii: false });
    const withPii = creatorAdminView(fixture, { includePii: true });
    expect(withPii.user.email).toBe('private@example.test');
    expect(without.user).not.toHaveProperty('email');
    expect(creatorAdminSelect().user.select).not.toHaveProperty('email');
    expect(creatorAdminSelect({ includePii: true }).user.select.email).toBe(true);
    expect(JSON.stringify(creatorSearchConditions('private@example.test'))).not.toContain('"email"');
    expect(JSON.stringify(creatorSearchConditions('private@example.test', { includePii: true }))).toContain('"email"');
    expect(formatCreatorsCsv([withPii])).not.toContain('private@example.test');
    expect(formatCreatorsCsv([withPii])).not.toContain('User Email');
    expect(formatCreatorsCsv([withPii], { includePii: true })).toContain('private@example.test');
    expect(formatCreatorsCsv([withPii], { includePii: true })).toContain('User Email');
    expect(formatCreatorsCsv([withPii])).toContain('"\'=SUM(1,2)"');
    expect(formatCreatorsCsv([{ ...withPii, displayName: '  =1+2' }])).toContain('"\'  =1+2"');
  });
});

describe('creator admin route PII enforcement', () => {
  it('omits PII from list and removes email matching from list/count queries', async () => {
    await start();
    const res = await app.inject({ url: '/api/admin/creators?q=private%40example.test', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().items[0].adminNote).toBe(fixture.adminNote);
    expect(res.body).not.toMatch(/private@example|email|futurePrivateColumn|passwordHash/);
    expect(JSON.stringify(prisma.creatorRegistration.findMany.mock.calls)).not.toContain('"email"');
    expect(JSON.stringify(prisma.creatorRegistration.count.mock.calls)).not.toContain('"email"');
  });
  it('omits creator email and redacts audit PII and secrets in detail responses', async () => {
    await start();
    const res = await app.inject({ url: '/api/admin/creators/registration-1', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().creator.user).not.toHaveProperty('email');
    expect(res.json().auditLogs[0].metadata).toEqual({ email: '[REDACTED]', ip: '[REDACTED]', password: '[REDACTED]', nested: { email: '[REDACTED]' } });
    expect(res.body).not.toMatch(/private@example|staff@example|nested@example|192\.0\.2\.1|futurePrivateColumn|secret-hash/);
    expect(prisma.creatorRegistration.findFirst.mock.calls[0][0].select.user.select).not.toHaveProperty('email');
  });
  it('omits email columns/data/search even when the database returns more fields than selected', async () => {
    await start();
    const res = await app.inject({ url: '/api/admin/creators/export?q=private%40example.test', headers });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).not.toContain('User Email');
    expect(res.body).not.toContain('private@example.test');
    expect(JSON.stringify(prisma.creatorRegistration.findMany.mock.calls)).not.toContain('"email"');
  });
  it.each([['status', { status: 'ENABLED' }], ['note', { note: 'Updated staff note' }]])('allowlists the %s mutation response', async (field, payload) => {
    await start();
    const res = await app.inject({ method: 'PATCH', url: `/api/admin/creators/registration-1/${field}`, headers, payload });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toMatch(/private@example|futurePrivateColumn|passwordHash|moderationMetadata/);
  });
  it.each(['LISTENER', 'ARTIST'])('rejects %s access to every creator admin surface', async nextRole => {
    role = nextRole;
    await start();
    for (const url of ['/api/admin/creators', '/api/admin/creators/export', '/api/admin/creators/registration-1']) {
      expect((await app.inject({ url, headers })).statusCode).toBe(403);
    }
    expect((await app.inject({ method: 'PATCH', url: '/api/admin/creators/registration-1/note', headers, payload: { note: 'x' } })).statusCode).toBe(403);
    expect(prisma.creatorRegistration.findMany).not.toHaveBeenCalled();
  });
});
