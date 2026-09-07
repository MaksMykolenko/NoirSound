import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../src/plugins/auth.js';
import authRoutes from '../src/routes/auth.js';

let app;
let prisma;
let state;
let failCreator;
let uniqueConflict;
const env = {};
const payload = { email: 'person@example.test', username: 'person_123', displayName: 'A Person', password: 'password123' };
const staffOnly = { adminNote: 'internal staff-only note', reviewedAt: new Date(), enabledAt: new Date(), futureSecret: 'secret-column' };
beforeEach(async () => {
  for (const key of ['JWT_SECRET', 'COOKIE_SECRET']) env[key] = process.env[key];
  process.env.JWT_SECRET = 'registration-route-test-jwt-at-least-32-characters';
  process.env.COOKIE_SECRET = 'registration-route-test-cookie-at-least-32-characters';
  state = { users: [], profiles: [], creators: [], sessions: [], audits: [] };
  failCreator = false;
  uniqueConflict = null;
  const creatorRow = data => ({ id: `creator-${state.creators.length + 1}`, createdAt: new Date(), ...staffOnly, ...data });
  prisma = {
    user: {
      findMany: vi.fn(async ({ where, take }) => state.users.filter(user =>
        user.email.toLowerCase() === where.email.equals.toLowerCase()).slice(0, take)),
      findFirst: vi.fn(async ({ where }) => state.users.find(user => (where.OR || [where]).some(filter =>
        Object.entries(filter).some(([key, value]) => user[key]?.toLowerCase() === (value.equals || value).toLowerCase()))) || null),
      findUnique: vi.fn(async ({ where }) => state.users.find(user => user.id === where.id) || null),
      create: vi.fn(async ({ data }) => {
        if (uniqueConflict) throw { code: 'P2002', meta: { target: [uniqueConflict] } };
        const user = { id: `user-${state.users.length + 1}`, status: 'ACTIVE', futureInternalColumn: 'internal-user', ...data };
        state.users.push(user); return user;
      })
    },
    artistProfile: {
      findUnique: vi.fn(async ({ where }) => state.profiles.find(row => row.userId === where.userId) || null),
      createMany: vi.fn(async ({ data }) => {
        let count = 0;
        for (const item of data) {
          if (state.profiles.some(row => row.userId === item.userId)) continue;
          state.profiles.push({ id: `artist-${state.profiles.length + 1}`, ...item }); count += 1;
        }
        return { count };
      }),
      create: vi.fn(async ({ data }) => { const row = { id: `artist-${state.profiles.length + 1}`, ...data }; state.profiles.push(row); return row; })
    },
    creatorRegistration: {
      findUnique: vi.fn(async ({ where }) => state.creators.find(row => row.userId === where.userId) || null),
      create: vi.fn(async ({ data }) => { if (failCreator) throw new Error('creator persistence failed'); const row = creatorRow(data); state.creators.push(row); return row; }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = state.creators.find(row => row.userId === where.userId);
        if (existing) { Object.assign(existing, update); return existing; }
        const row = creatorRow(create); state.creators.push(row); return row;
      })
    },
    session: {
      create: vi.fn(async ({ data }) => { state.sessions.push(data); return data; }),
      findUnique: vi.fn(async ({ where }) => state.sessions.find(row => row.id === where.id) || null)
    },
    auditLog: { create: vi.fn(async ({ data }) => { state.audits.push(data); return data; }) },
    $transaction: vi.fn(async callback => {
      const before = structuredClone(state);
      try { return await callback(prisma); } catch (error) { state = before; throw error; }
    })
  };
  app = Fastify(); app.decorate('prisma', prisma); app.decorate('storage', {});
  app.register(authPlugin); app.register(authRoutes, { prefix: '/api/auth' }); await app.ready();
});
afterEach(async () => {
  await app.close();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const register = body => app.inject({ method: 'POST', url: '/api/auth/register', payload: body });

describe('registration and onboarding HTTP contracts', () => {
  it.each([
    [{ email: 'invalid' }, 'REGISTER_EMAIL_INVALID'], [{ username: 'x' }, 'REGISTER_USERNAME_INVALID'],
    [{ password: 'x' }, 'REGISTER_PASSWORD_INVALID'], [{ creatorType: 'ADMIN' }, 'REGISTER_CREATOR_TYPE_INVALID'],
    [{ displayName: '' }, 'REGISTER_DISPLAY_NAME_INVALID'], [{ intendsBeats: 'true' }, 'REGISTER_INTENT_INVALID'],
    [{ portfolioUrl: 'javascript:alert(1)' }, 'INVALID_URL']
  ])('returns a stable validation error without any persistence for %j', async (override, code) => {
    const res = await register({ ...payload, ...override });
    expect(res.statusCode).toBe(400); expect(res.json().error).toBe(code);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(state.users).toHaveLength(0);
  });
  it('creates an ordinary listener and supports login with normalized identifiers', async () => {
    const res = await register({ ...payload, email: ' Person@Example.Test ', username: ' Person_123 ', role: 'ADMIN', permissions: ['pii.read'], canUploadTracks: true });
    expect(res.statusCode).toBe(200); expect(res.headers['set-cookie']).toContain('HttpOnly');
    expect(res.json().user).toMatchObject({ email: payload.email, username: payload.username, role: 'LISTENER', canUploadTracks: false, creatorRegistration: null });
    expect(res.body).not.toMatch(/passwordHash|futureInternalColumn|permissions/);
    expect(state.profiles).toHaveLength(0); expect(state.creators).toHaveLength(0); expect(state.sessions).toHaveLength(1);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ' PERSON@EXAMPLE.TEST ', password: payload.password } });
    expect(login.statusCode).toBe(200); expect(login.headers['set-cookie']).toContain('HttpOnly');
    expect(login.body).not.toMatch(/passwordHash|futureInternalColumn/);
  });
  it.each(['ARTIST', 'BEATMAKER', 'BOTH'])('atomically prepares %s without granting upload/admin privileges', async creatorType => {
    const res = await register({ ...payload, accountType: 'CREATOR', creatorType, role: 'ADMIN', status: 'ENABLED', adminNote: 'client injection' });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ role: 'LISTENER', hasArtistProfile: true, canUploadTracks: false, creatorRegistration: { creatorType } });
    expect(res.body).not.toMatch(/adminNote|reviewedAt|enabledAt|futureSecret|futureInternalColumn/);
    expect(res.json().user.creatorRegistration).not.toHaveProperty('status');
    expect(state.creators[0]).toMatchObject({ userId: state.users[0].id, status: 'REGISTERED', creatorType });
    expect(state.profiles).toHaveLength(1); expect(state.sessions).toHaveLength(1); expect(state.audits).toHaveLength(1);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
  it.each(['person@example.test', ' PERSON@EXAMPLE.TEST '])('rejects ambiguous legacy email %s without issuing a session or changing either account', async email => {
    expect((await register(payload)).statusCode).toBe(200);
    state.users.push({ ...state.users[0], id: 'legacy-case-variant', email: 'Person@Example.Test', username: 'legacy_variant' });
    const before = structuredClone(state);
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: payload.password } });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Invalid credentials' });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(state).toEqual(before);
  });
  it.each([['email', { email: 'PERSON@EXAMPLE.TEST', username: 'different' }, 'REGISTER_EMAIL_EXISTS'], ['username', { email: 'different@example.test', username: 'PERSON_123' }, 'REGISTER_USERNAME_EXISTS']])('rejects normalized duplicate %s without a partial account', async (_field, values, code) => {
    expect((await register(payload)).statusCode).toBe(200);
    const duplicate = await register({ ...payload, ...values });
    expect(duplicate.statusCode).toBe(409); expect(duplicate.json().error).toBe(code);
    expect(state.users).toHaveLength(1); expect(state.sessions).toHaveLength(1);
  });
  it.each([['email', 'REGISTER_EMAIL_EXISTS'], ['username', 'REGISTER_USERNAME_EXISTS']])('maps concurrent %s uniqueness violations to a stable conflict', async (field, code) => {
    uniqueConflict = field;
    const res = await register(payload);
    expect(res.statusCode).toBe(409); expect(res.json().error).toBe(code);
    expect(state.users).toHaveLength(0); expect(state.sessions).toHaveLength(0);
  });
  it('rolls back the account/profile/session when creator persistence fails', async () => {
    failCreator = true;
    const res = await register({ ...payload, creatorType: 'BOTH' });
    expect(res.statusCode).toBe(500); expect(res.headers['set-cookie']).toBeUndefined();
    expect(state).toEqual({ users: [], profiles: [], creators: [], sessions: [], audits: [] });
  });
  it('keeps persisted staff notes and status out of onboarding, registration and me, including future columns', async () => {
    const registration = await register({ ...payload, creatorType: 'ARTIST' });
    const headers = { cookie: registration.headers['set-cookie'].split(';')[0] };
    state.creators[0].status = 'REVIEWED';
    const res = await app.inject({ method: 'POST', url: '/api/auth/creator-onboarding', headers,
      payload: { creatorType: 'BEATMAKER', adminNote: 'overwrite attempt', status: 'ENABLED', role: 'ADMIN', displayName: 'Beat Maker' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().creatorRegistration.creatorType).toBe('BEATMAKER');
    expect(res.json().user.role).toBe('LISTENER');
    expect(res.body).not.toMatch(/adminNote|reviewedAt|enabledAt|futureSecret|futureInternalColumn/);
    expect(res.json().creatorRegistration).not.toHaveProperty('status');
    expect(state.creators[0].adminNote).toBe(staffOnly.adminNote);
    expect(state.creators[0].status).toBe('REVIEWED');
    const me = await app.inject({ url: '/api/auth/me', headers });
    expect(me.statusCode).toBe(200); expect(me.body).not.toMatch(/adminNote|reviewedAt|enabledAt|futureSecret|futureInternalColumn/);
    expect(me.json().user.creatorRegistration).not.toHaveProperty('status');
    const invalid = await app.inject({ method: 'POST', url: '/api/auth/creator-onboarding', headers, payload: { creatorType: 'SUPERADMIN' } });
    expect(invalid.statusCode).toBe(400); expect(invalid.json().error).toBe('REGISTER_CREATOR_TYPE_INVALID');
    expect(state.creators[0].creatorType).toBe('BEATMAKER');
  });
});
