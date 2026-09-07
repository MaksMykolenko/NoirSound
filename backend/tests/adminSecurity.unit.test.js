import { describe, expect, it, vi } from 'vitest';
import adminGuard from '../src/lib/adminGuard';
import auditLog from '../src/lib/auditLog';
import adminAudit from '../src/lib/adminAudit';
import adminRoutes from '../src/routes/admin';
import statsIntegrity from '../src/lib/statsIntegrity';

const {
  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  adminPermissionGuard,
  adminReadOptions,
  hasAdminPermission,
} = adminGuard;
const { auditData, auditRequestContext } = auditLog;
const {
  AdminAuditQueryError,
  auditLogsCsv,
  buildAuditWhere,
  parseAuditExportQuery,
  parseAuditListQuery,
} = adminAudit;
const { findMissingArtistProfiles } = statsIntegrity;

describe('admin permission registry', () => {
  it('assigns every registered permission only to ADMIN and defaults unknown permissions to deny', async () => {
    const permissions = Object.values(ADMIN_PERMISSIONS);
    expect(new Set(permissions).size).toBe(permissions.length);
    expect(ROLE_PERMISSIONS.ADMIN).toEqual(
      permissions.filter((permission) => permission !== ADMIN_PERMISSIONS.PII_READ),
    );
    expect(ROLE_PERMISSIONS.ARTIST).toEqual([]);
    expect(ROLE_PERMISSIONS.LISTENER).toEqual([]);
    expect(hasAdminPermission('ADMIN', ADMIN_PERMISSIONS.AUDIT_EXPORT)).toBe(true);
    expect(hasAdminPermission('ADMIN', ADMIN_PERMISSIONS.PII_READ)).toBe(false);
    expect(hasAdminPermission('ARTIST', ADMIN_PERMISSIONS.AUDIT_READ)).toBe(false);
    expect(hasAdminPermission('ADMIN', 'admin.unregistered.read')).toBe(false);

    const status = vi.fn();
    const send = vi.fn();
    status.mockReturnValue({ send });
    await adminPermissionGuard(undefined)({ user: { role: 'ADMIN' } }, { status });
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ error: 'ADMIN_PERMISSION_DENIED' }));
  });

  it('stores the explicit permission on route configuration', () => {
    const authenticate = vi.fn();
    const options = adminReadOptions({ authenticate }, ADMIN_PERMISSIONS.TRACKS_PREVIEW);
    expect(options.config.adminPermission).toBe(ADMIN_PERMISSIONS.TRACKS_PREVIEW);
    expect(options.preValidation).toHaveLength(2);
  });

  it('registers every admin endpoint with a known explicit permission', async () => {
    const routes = [];
    const capture = (method) => (path, options) => routes.push({ method, path, options });
    const fastify = {
      authenticate: vi.fn(),
      setErrorHandler: vi.fn(),
      get: capture('GET'),
      post: capture('POST'),
      patch: capture('PATCH'),
    };
    await adminRoutes(fastify);

    expect(routes).toHaveLength(54);
    expect(routes.every(({ options }) =>
      Object.values(ADMIN_PERMISSIONS).includes(options.config.adminPermission))).toBe(true);
    expect(routes.find(({ path }) => path === '/audit-logs/export').options.config.adminPermission)
      .toBe(ADMIN_PERMISSIONS.AUDIT_EXPORT);
    expect(routes.find(({ path }) => path === '/tracks/:id/preview').options.config.adminPermission)
      .toBe(ADMIN_PERMISSIONS.TRACKS_PREVIEW);
    expect(routes.find(({ path }) => path === '/creators/export').options.config.adminPermission)
      .toBe(ADMIN_PERMISSIONS.USERS_READ);
  });
});

describe('admin audit query and export hardening', () => {
  it('accepts only 25, 50, or 100 list rows and validates filters without coercion', () => {
    expect(parseAuditListQuery({})).toMatchObject({ page: 1, pageSize: 25, take: 25 });
    expect(parseAuditListQuery({ page: '2', pageSize: '50' })).toMatchObject({
      page: 2,
      pageSize: 50,
      skip: 50,
      take: 50,
    });
    expect(parseAuditListQuery({ limit: '100', environment: 'test', result: 'success' }))
      .toMatchObject({ pageSize: 100, environment: 'TEST', result: 'SUCCESS' });
    expect(() => parseAuditListQuery({ pageSize: '30' })).toThrow(AdminAuditQueryError);
    expect(() => parseAuditListQuery({ from: '2026-02-30' })).toThrow(AdminAuditQueryError);
    expect(() => parseAuditListQuery({ from: '2026-09-03', to: '2026-09-02' })).toThrow(AdminAuditQueryError);
    expect(() => parseAuditListQuery({ surprise: 'true' })).toThrow(AdminAuditQueryError);
    expect(() => parseAuditExportQuery({ limit: '5001' })).toThrow(AdminAuditQueryError);

    const where = buildAuditWhere(parseAuditListQuery({ q: 'request-123' }));
    expect(where.AND[0].OR).toContainEqual({
      metadata: { path: ['context', 'request', 'id'], string_contains: 'request-123' },
    });
    expect(JSON.stringify(where)).not.toContain('email');

    const piiWhere = buildAuditWhere(
      parseAuditListQuery({ q: 'private@example.invalid', actor: 'private@example.invalid' }),
      { includePii: true },
    );
    expect(JSON.stringify(piiWhere)).toContain('email');
  });

  it('sanitizes stored context, redacts secrets, and neutralizes spreadsheet formulas', () => {
    const context = auditRequestContext({
      id: 'request-123',
      method: 'POST',
      routeOptions: { url: '/tracks/:id/hide' },
    }, { environment: 'test', result: 'SUCCESS' });
    const record = auditData(
      'actor-1',
      'TRACK_HIDE',
      'TRACK',
      'track-1',
      '=HYPERLINK("https://example.invalid")',
      {
        safe: 'visible',
        password: 'must-not-leak',
        email: 'private@example.invalid',
        ip: '203.0.113.10',
        userAgent: 'Private Browser',
        callback: 'https://example.invalid/?token=must-not-leak',
      },
      context,
    );
    expect(record.metadata.password).toBe('[REDACTED]');
    expect(record.metadata.callback).toContain('token=[REDACTED]');
    expect(record.metadata.context).toMatchObject({
      source: 'ADMIN_API',
      environment: 'TEST',
      result: 'SUCCESS',
      request: { id: 'request-123', method: 'POST', route: '/tracks/:id/hide' },
    });
    expect(auditData('actor-1', 'TEST', 'SYSTEM', 'test', 'Bearer reason-secret').reason)
      .toBe('[REDACTED]');

    const log = {
      id: 'audit-1',
      createdAt: new Date('2026-09-03T12:00:00.000Z'),
      ...record,
      actor: { email: '+formula@example.invalid', username: '@operator' },
      internalDatabaseRow: 'must-not-be-serialized',
    };
    const csv = auditLogsCsv([log], { includePii: true });
    expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"")"');
    expect(csv).toContain('"\'+formula@example.invalid"');
    expect(csv).toContain('"\'@operator"');
    expect(csv).toContain('[REDACTED]');
    expect(csv).not.toContain('must-not-leak');
    expect(csv).not.toContain('must-not-be-serialized');

    const withoutPii = auditLogsCsv([log]);
    expect(withoutPii).not.toContain('+formula@example.invalid');
    expect(withoutPii).not.toContain('private@example.invalid');
    expect(withoutPii).not.toContain('203.0.113.10');
    expect(withoutPii).not.toContain('Private Browser');
    expect(withoutPii).toContain('[REDACTED]');
  });
});

describe('admin resource PII query boundaries', () => {
  it('does not select stats-integrity email unless the caller explicitly opts into PII', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { user: { findMany } };

    await findMissingArtistProfiles(prisma);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      select: { id: true, username: true, role: true },
    }));

    await findMissingArtistProfiles(prisma, { includePii: true });
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      select: { id: true, username: true, email: true, role: true },
    }));
  });
});
