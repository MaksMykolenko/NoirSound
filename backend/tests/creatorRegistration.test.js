import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import pg from 'pg';
import buildServer from '../src/index';
import seedModule from '../prisma/seed';

const { seedDemo } = seedModule;

async function requestWithParserDiagnostics(stage, request) {
  try {
    return await request;
  } catch (error) {
    const packet = Buffer.isBuffer(error.rawPacket) ? error.rawPacket : null;
    const safeReason = typeof error.reason === 'string'
      && !/(?:https?:\/\/|authorization|cookie|token|password)/i.test(error.reason)
      ? error.reason.slice(0, 160) : null;
    const diagnostic = {
      code: /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : null,
      reason: safeReason,
      bytesParsed: Number.isSafeInteger(error.bytesParsed) ? error.bytesParsed : null,
      packetLength: packet?.length ?? null,
      packetStartsWithHttp: packet ? packet.subarray(0, 5).equals(Buffer.from('HTTP/')) : null
    };
    // Do not attach the original error: its raw packet can contain session cookies.
    throw new Error(`${stage} HTTP request failed: ${JSON.stringify(diagnostic)}`);
  }
}

describe('Creator Registration & Public App Gate API', () => {
  let app;
  let listeningEvents = 0;
  let adminCookie;
  let listenerCookie;
  let _artistCookie;

  beforeAll(async () => {
    app = buildServer();
    app.server.on('listening', () => { listeningEvents += 1; });
    // The fixture owns one real HTTP listener; Supertest must not reopen it per request.
    await app.listen({ host: '127.0.0.1', port: 0 });
    await seedDemo(app.prisma);

    const adminLogin = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'admin@noirsound.com', password: 'password123' });
    adminCookie = adminLogin.headers['set-cookie'];

    const listenerLogin = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'listener@noirsound.com', password: 'password123' });
    listenerCookie = listenerLogin.headers['set-cookie'];

    const artistLogin = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'artist@noirsound.com', password: 'password123' });
    _artistCookie = artistLogin.headers['set-cookie'];
  });

  afterAll(async () => {
    delete process.env.PUBLIC_APP_ENABLED;
    await app.close();
    expect(listeningEvents).toBe(1);
  });

  describe('Public App Gate (PUBLIC_APP_ENABLED=false)', () => {
    beforeAll(() => {
      process.env.PUBLIC_APP_ENABLED = 'false';
    });

    afterAll(() => {
      delete process.env.PUBLIC_APP_ENABLED;
    });

    it('allows whitelisted endpoints: /api/ready, /api/auth, /api/tracks/showcase', async () => {
      const readyRes = await supertest(app.server).get('/api/ready');
      expect(readyRes.status).toBe(200);

      // Auth endpoint responds normally (400 for bad payload, not 403 gate error)
      const authRes = await supertest(app.server).post('/api/auth/login').send({});
      expect(authRes.status).toBe(400);

      const showcaseRes = await supertest(app.server).get('/api/tracks/showcase');
      expect(showcaseRes.status).toBe(200);
    });

    it('blocks anonymous access to protected application APIs with 403 PUBLIC_APP_NOT_ENABLED', async () => {
      const res = await supertest(app.server).get('/api/tracks');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PUBLIC_APP_NOT_ENABLED');
    });

    it('blocks normal authenticated user from protected application APIs with 403', async () => {
      const res = await supertest(app.server)
        .get('/api/tracks')
        .set('Cookie', listenerCookie);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PUBLIC_APP_NOT_ENABLED');
    });

    it('allows ADMIN bypass to access full application APIs', async () => {
      const res = await supertest(app.server)
        .get('/api/tracks')
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
    });

    it('allows ADMIN to access /api/admin routes', async () => {
      const res = await supertest(app.server)
        .get('/api/admin/overview')
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
    });
  });

  describe('Registration Flows', () => {
    it('rejects real legacy case-variant emails without changing either stored account', async () => {
      const suffix = Date.now().toString(36);
      const email = `legacy_${suffix}@example.test`;
      const password = 'Password123!';
      const registered = await supertest(app.server).post('/api/auth/register').send({
        email, username: `legacy_${suffix}`, displayName: 'Legacy Identity', password
      });
      expect(registered.statusCode).toBe(200);
      const original = await app.prisma.user.findUnique({ where: { id: registered.body.user.id } });
      const variant = await app.prisma.user.create({ data: {
        email: email.toUpperCase(), username: `variant_${suffix}`, displayName: 'Separate Legacy Identity', passwordHash: original.passwordHash
      } });
      const sessions = await app.prisma.session.count();
      const login = await supertest(app.server).post('/api/auth/login').send({ email, password });
      expect(login.statusCode).toBe(401);
      expect(login.body).toEqual({ error: 'Invalid credentials' });
      expect(login.headers['set-cookie']).toBeUndefined();
      expect(await app.prisma.session.count()).toBe(sessions);
      expect(await app.prisma.user.findUnique({ where: { id: original.id } })).toEqual(original);
      expect(await app.prisma.user.findUnique({ where: { id: variant.id } })).toEqual(variant);
    });

    it('allows concurrent onboarding in real transactions without duplicate profiles or transaction aborts', async () => {
      const suffix = Date.now().toString(36);
      const registered = await supertest(app.server).post('/api/auth/register').send({
        email: `concurrent_${suffix}@example.test`, username: `concurrent_${suffix}`,
        displayName: 'Concurrent Creator', password: 'Password123!', accountType: 'LISTENER'
      });
      expect(registered.statusCode).toBe(200);
      const userId = registered.body.user.id;
      const cookie = registered.headers['set-cookie'];
      const originalTransaction = app.prisma.$transaction.bind(app.prisma);
      const originalQuery = pg.Client.prototype.query;
      const profileInserts = [];
      const querySpy = vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (...args) {
        const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
        if (/INSERT\s+INTO\s+(?:"public"\.)?"ArtistProfile"/i.test(sql)) profileInserts.push(sql);
        return originalQuery.apply(this, args);
      });
      // Force both old read/create callers to observe the missing profile.
      // Atomic insertion needs no read barrier: it reaches findUnique only after reservation.
      let missingReads = 0;
      let releaseReads;
      const readsReady = new Promise(resolve => { releaseReads = resolve; });
      const transactionSpy = vi.spyOn(app.prisma, '$transaction').mockImplementation(callback =>
        originalTransaction(async tx => {
          const profile = new Proxy(tx.artistProfile, { get(target, key) {
            if (key !== 'findUnique') return target[key];
            return async args => {
              const result = await target.findUnique(args);
              if (args.where.userId === userId && !result) {
                missingReads += 1;
                if (missingReads === 2) releaseReads();
                await readsReady;
              }
              return result;
            };
          } });
          return callback(new Proxy(tx, { get(target, key) { return key === 'artistProfile' ? profile : target[key]; } }));
        }));
      try {
        const responses = await Promise.all([1, 2].map(() => supertest(app.server)
          .post('/api/auth/creator-onboarding').set('Cookie', cookie)
          .send({ creatorType: 'BOTH', displayName: 'Concurrent Creator' })));
        expect(responses.map(response => response.statusCode)).toEqual([200, 200]);
        expect(await app.prisma.artistProfile.count({ where: { userId } })).toBe(1);
        expect(await app.prisma.creatorRegistration.count({ where: { userId } })).toBe(1);
        expect(await app.prisma.auditLog.count({ where: { actorId: userId, action: 'CREATOR_REGISTERED' } })).toBe(2);
        expect(profileInserts).toHaveLength(2);
        expect(profileInserts.every(sql => /ON\s+CONFLICT\s+DO\s+NOTHING/i.test(sql))).toBe(true);
        console.info('Profile concurrency: two HTTP200 responses, one profile/registration, two audits; PostgreSQL ON CONFLICT DO NOTHING confirmed.');
      } finally {
        transactionSpy.mockRestore();
        querySpy.mockRestore();
      }
    });

    it('preserves existing profile fields during concurrent creator onboarding', async () => {
      const suffix = Date.now().toString(36);
      const registered = await supertest(app.server).post('/api/auth/register').send({
        email: `preserved_${suffix}@example.test`, username: `preserved_${suffix}`,
        displayName: 'Existing Creator', password: 'Password123!', creatorType: 'ARTIST'
      });
      expect(registered.statusCode).toBe(200);
      const userId = registered.body.user.id;
      const profile = await app.prisma.artistProfile.update({ where: { userId }, data: {
        monthlyListeners: 42, genres: ['rock'], socialLinks: { website: 'https://example.test/artist' }, isHidden: true
      } });
      const responses = await Promise.all([1, 2].map(() => supertest(app.server)
        .post('/api/auth/creator-onboarding').set('Cookie', registered.headers['set-cookie'])
        .send({ creatorType: 'BEATMAKER', displayName: 'Existing Creator' })));
      expect(responses.map(response => response.statusCode)).toEqual([200, 200]);
      expect(await app.prisma.artistProfile.findUnique({ where: { userId } })).toEqual(profile);
      expect(responses.every(response => response.body.user.role === 'LISTENER' && !response.body.user.canUploadTracks)).toBe(true);
    });

    it('registers a standard listener without creating CreatorRegistration or ArtistProfile', async () => {
      const suffix = Date.now();
      const res = await supertest(app.server)
        .post('/api/auth/register')
        .send({
          email: `listener_${suffix}@test.com`,
          username: `listener_${suffix}`,
          displayName: `Listener ${suffix}`,
          password: 'Password123!',
          accountType: 'LISTENER'
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('LISTENER');
      expect(res.body.user.hasArtistProfile).toBe(false);
      expect(res.body.user.creatorRegistration).toBeNull();
    });

    it('rejects creator registration with invalid URL scheme (e.g. javascript: or ftp:)', async () => {
      const suffix = Date.now();
      const res = await supertest(app.server)
        .post('/api/auth/register')
        .send({
          email: `badurl_${suffix}@test.com`,
          username: `badurl_${suffix}`,
          displayName: `Bad Url ${suffix}`,
          password: 'Password123!',
          accountType: 'CREATOR',
          creatorType: 'ARTIST',
          portfolioUrl: 'javascript:alert(1)'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_URL');
    });

    it('registers a creator: creates user, ensures ArtistProfile, creates CreatorRegistration, keeps role LISTENER', async () => {
      const suffix = Date.now();
      const res = await supertest(app.server)
        .post('/api/auth/register')
        .send({
          email: `creator_${suffix}@test.com`,
          username: `creator_${suffix}`,
          displayName: `Creator ${suffix}`,
          password: 'Password123!',
          accountType: 'CREATOR',
          creatorType: 'BOTH',
          intendsMusic: true,
          intendsBeats: true,
          portfolioUrl: 'https://soundcloud.com/test-creator',
          primaryPlatformUrl: 'https://youtube.com/@test-creator',
          note: 'Synthwave & electronic producer'
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('LISTENER'); // Decoupled: cannot upload yet
      expect(res.body.user.canUploadTracks).toBe(false);
      expect(res.body.user.hasArtistProfile).toBe(true); // ArtistProfile prepared
      expect(res.body.user.creatorRegistration).toBeDefined();
      expect(res.body.user.creatorRegistration.creatorType).toBe('BOTH');
      expect(res.body.user.creatorRegistration).not.toHaveProperty('status');
      const stored = await app.prisma.creatorRegistration.findUnique({ where: { userId: res.body.user.id } });
      expect(stored.status).toBe('REGISTERED');
    });

    it('allows an authenticated listener to register as a creator via /api/auth/creator-onboarding', async () => {
      const suffix = Date.now();
      const reg = await requestWithParserDiagnostics('onboarding registration', supertest(app.server)
        .post('/api/auth/register')
        .send({
          email: `onboard_${suffix}@test.com`,
          username: `onboard_${suffix}`,
          displayName: `Onboard ${suffix}`,
          password: 'Password123!',
          accountType: 'LISTENER'
        }));
      const cookie = reg.headers['set-cookie'];

      const onboardRes = await requestWithParserDiagnostics('creator onboarding', supertest(app.server)
        .post('/api/auth/creator-onboarding')
        .set('Cookie', cookie)
        .send({
          creatorType: 'BEATMAKER',
          intendsMusic: false,
          intendsBeats: true,
          portfolioUrl: 'https://beatstars.com/test-onboard',
          displayName: 'Beat Master'
        }));

      expect(onboardRes.status).toBe(200);
      expect(onboardRes.body.creatorRegistration.creatorType).toBe('BEATMAKER');
      expect(onboardRes.body.creatorRegistration.intendsBeats).toBe(true);
      expect(onboardRes.body.user.hasArtistProfile).toBe(true);
    });
  });

  describe('Admin Creator Management', () => {
    let testCreatorId;

    beforeAll(async () => {
      const suffix = Date.now();
      const res = await supertest(app.server)
        .post('/api/auth/register')
        .send({
          email: `admin_creator_${suffix}@test.com`,
          username: `admin_creator_${suffix}`,
          displayName: `Admin Creator ${suffix}`,
          password: 'Password123!',
          accountType: 'CREATOR',
          creatorType: 'ARTIST',
          portfolioUrl: 'https://spotify.com/artist/test'
        });
      testCreatorId = res.body.user.creatorRegistration.id;
    });

    it('rejects non-admin access to /api/admin/creators with 403', async () => {
      const res = await supertest(app.server)
        .get('/api/admin/creators')
        .set('Cookie', listenerCookie);
      expect(res.status).toBe(403);
    });

    it('lists creator registrations for admin with counts and pagination', async () => {
      const res = await supertest(app.server)
        .get('/api/admin/creators')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeInstanceOf(Array);
      expect(res.body.counts).toBeDefined();
      expect(res.body.counts.TOTAL).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    });

    it('retrieves detailed creator view via GET /api/admin/creators/:id', async () => {
      const res = await supertest(app.server)
        .get(`/api/admin/creators/${testCreatorId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.creator).toBeDefined();
      expect(res.body.userAccess).toBeDefined();
      expect(res.body.userAccess.hasArtistProfile).toBe(true);
    });

    it('transitions creator registration status to REVIEWED', async () => {
      const res = await supertest(app.server)
        .patch(`/api/admin/creators/${testCreatorId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'REVIEWED', reason: 'Reviewed audio samples' });

      expect(res.status).toBe(200);
      expect(res.body.creator.status).toBe('REVIEWED');
    });

    it('updates admin evaluation note via PATCH /api/admin/creators/:id/note', async () => {
      const res = await supertest(app.server)
        .patch(`/api/admin/creators/${testCreatorId}/note`)
        .set('Cookie', adminCookie)
        .send({ note: 'Verified SoundCloud tracks and production quality.' });

      expect(res.status).toBe(200);
      expect(res.body.creator.adminNote).toContain('Verified SoundCloud');
    });

    it('exports creator registrations as CSV with formula injection escaping', async () => {
      // Create user with dangerous formula prefix in display name
      const suffix = Date.now();
      await supertest(app.server)
        .post('/api/auth/register')
        .send({
          email: `formula_${suffix}@test.com`,
          username: `formula_${suffix}`,
          displayName: '=SUM(1,2)',
          password: 'Password123!',
          accountType: 'CREATOR',
          creatorType: 'ARTIST'
        });

      const res = await supertest(app.server)
        .get('/api/admin/creators/export')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain("\"'=SUM(1,2)\"");
    });
  });
});
