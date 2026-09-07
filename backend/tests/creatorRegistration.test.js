import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import buildServer from '../src/index';
import seedModule from '../prisma/seed';

const { seedDemo } = seedModule;

describe('Creator Registration & Public App Gate API', () => {
  let app;
  let adminCookie;
  let listenerCookie;
  let _artistCookie;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
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
      const reg = await supertest(app.server)
        .post('/api/auth/register')
        .send({
          email: `onboard_${suffix}@test.com`,
          username: `onboard_${suffix}`,
          displayName: `Onboard ${suffix}`,
          password: 'Password123!',
          accountType: 'LISTENER'
        });
      const cookie = reg.headers['set-cookie'];

      const onboardRes = await supertest(app.server)
        .post('/api/auth/creator-onboarding')
        .set('Cookie', cookie)
        .send({
          creatorType: 'BEATMAKER',
          intendsMusic: false,
          intendsBeats: true,
          portfolioUrl: 'https://beatstars.com/test-onboard',
          displayName: 'Beat Master'
        });

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
