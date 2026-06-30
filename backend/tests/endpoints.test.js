import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import buildServer from '../src/index';
import { markProcessingFailed } from '../src/workers/audioProcessor';
import seedModule from '../prisma/seed';

const {
  DEMO_ARTISTS,
  DEMO_TRACKS,
  DEMO_TRACK_SLUGS,
  DEMO_PLAYLIST_ID,
  DEMO_COMMENT_ID,
  DEMO_PLAY_EVENT_ID,
  seedDemo,
} = seedModule;

describe('NoirSound backend integration', () => {
  let app;
  let listenerCookie;
  let artistCookie;
  let adminCookie;
  const objectMetadata = new Map();
  const queueAdd = vi.fn(async (_name, _data, options) => ({ id: options.jobId }));

  const storage = {
    createPresignedPutUrl: vi.fn(async (key) =>
      `http://storage.test/upload/${encodeURIComponent(key)}`),
    createPresignedGetUrl: vi.fn(async (key) =>
      `http://storage.test/read/${encodeURIComponent(key)}`),
    getPublicOrSignedUrl: vi.fn(async (key) =>
      `http://storage.test/read/${encodeURIComponent(key)}`),
    getObjectMetadata: vi.fn(async (key) =>
      objectMetadata.get(key) || { exists: false })
  };
  const audioQueue = {
    add: queueAdd
  };
  const previousRateMultiplier = process.env.RATE_LIMIT_MULTIPLIER;

  beforeAll(async () => {
    process.env.RATE_LIMIT_MULTIPLIER = '10';
    app = buildServer({ storage, audioQueue });
    await app.ready();

    await seedDemo(app.prisma);

    const listenerLogin = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'listener@noirsound.com', password: 'password123' });
    listenerCookie = listenerLogin.headers['set-cookie'];

    const artistLogin = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'artist@noirsound.com', password: 'password123' });
    artistCookie = artistLogin.headers['set-cookie'];

    const adminLogin = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'admin@noirsound.com', password: 'password123' });
    adminCookie = adminLogin.headers['set-cookie'];
  });

  afterAll(async () => {
    await app.close();
    if (previousRateMultiplier === undefined) delete process.env.RATE_LIMIT_MULTIPLIER;
    else process.env.RATE_LIMIT_MULTIPLIER = previousRateMultiplier;
  });

  function validUploadBody(overrides = {}) {
    return {
      title: 'Integration Upload',
      description: 'Generated test fixture',
      genre: 'Electronic',
      tags: ['integration'],
      copyrightConfirmed: true,
      audio: {
        filename: 'fixture.wav',
        mimeType: 'audio/wav',
        sizeBytes: 2048
      },
      cover: {
        filename: 'cover.png',
        mimeType: 'image/png',
        sizeBytes: 1024
      },
      ...overrides
    };
  }

  async function initializeUpload(body = validUploadBody()) {
    return supertest(app.server)
      .post('/api/uploads/track/init')
      .set('Cookie', artistCookie)
      .send(body);
  }

  describe('health and auth', () => {
    it('returns the health check', async () => {
      const response = await supertest(app.server).get('/api/health');
      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    it('registers a user and returns an HTTP-only cookie', async () => {
      const suffix = Date.now();
      const response = await supertest(app.server)
        .post('/api/auth/register')
        .send({
          email: `integration_${suffix}@test.local`,
          password: 'Password123!',
          username: `integration_${suffix}`,
          displayName: 'Integration User'
        });
      expect(response.statusCode).toBe(200);
      expect(response.body.user.email).toContain('@test.local');
      expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    });

    it('logs in and hydrates the current user', async () => {
      const response = await supertest(app.server)
        .get('/api/auth/me')
        .set('Cookie', listenerCookie);
      expect(response.statusCode).toBe(200);
      expect(response.body.user.email).toBe('listener@noirsound.com');
    });

    it('hydrates the authenticated artist profile id without fabricating one', async () => {
      const artistResponse = await supertest(app.server)
        .get('/api/auth/me')
        .set('Cookie', artistCookie);
      const listenerResponse = await supertest(app.server)
        .get('/api/auth/me')
        .set('Cookie', listenerCookie);

      expect(artistResponse.body.user.artistProfileId).toBeTruthy();
      expect(listenerResponse.body.user.artistProfileId).toBeNull();
    });

    it('rejects unauthenticated current-user requests', async () => {
      const response = await supertest(app.server).get('/api/auth/me');
      expect(response.statusCode).toBe(401);
    });

    it('rejects suspended, banned, and deleted-status users at login and session hydration', async () => {
      const listener = await app.prisma.user.findUnique({
        where: { email: 'listener@noirsound.com' }
      });

      for (const status of ['SUSPENDED', 'BANNED', 'DELETED']) {
        await app.prisma.user.update({
          where: { id: listener.id },
          data: { status }
        });

        const login = await supertest(app.server)
          .post('/api/auth/login')
          .send({ email: 'listener@noirsound.com', password: 'password123' });
        expect(login.statusCode).toBe(401);

        const existingSession = await supertest(app.server)
          .get('/api/auth/me')
          .set('Cookie', listenerCookie);
        expect(existingSession.statusCode).toBe(401);
      }

      await app.prisma.user.update({
        where: { id: listener.id },
        data: { status: 'ACTIVE' }
      });
    });
  });

  describe('real user data contracts', () => {
    it('persists track likes and unlike operations without double counting', async () => {
      const track = await app.prisma.track.findFirst({
        where: { status: 'PUBLISHED' }
      });
      const before = track.likes;

      const firstLike = await supertest(app.server)
        .post(`/api/tracks/${track.id}/like`)
        .set('Cookie', listenerCookie);
      const duplicateLike = await supertest(app.server)
        .post(`/api/tracks/${track.id}/like`)
        .set('Cookie', listenerCookie);
      const afterLike = await app.prisma.track.findUnique({ where: { id: track.id } });

      expect(firstLike.statusCode).toBe(200);
      expect(duplicateLike.statusCode).toBe(200);
      expect(afterLike.likes).toBe(before + 1);

      const unlike = await supertest(app.server)
        .delete(`/api/tracks/${track.id}/like`)
        .set('Cookie', listenerCookie);
      const afterUnlike = await app.prisma.track.findUnique({ where: { id: track.id } });

      expect(unlike.statusCode).toBe(200);
      expect(afterUnlike.likes).toBe(before);
    });

    it('returns only calculated listening stats fields', async () => {
      const response = await supertest(app.server)
        .get('/api/me/listening-stats')
        .set('Cookie', listenerCookie);

      expect(response.statusCode).toBe(200);
      expect(response.body.totalListeningSeconds).toBeTypeOf('number');
      expect(response.body.totalListeningMinutes).toBeTypeOf('number');
      expect(response.body.tracksPlayed).toBeTypeOf('number');
      expect(response.body.topGenres).toBeInstanceOf(Array);
      expect(response.body).not.toHaveProperty('listeningStreakDays');
      expect(response.body).not.toHaveProperty('weeklyMinutes');
      expect(response.body).not.toHaveProperty('moods');
    });

    it('keeps demo seed records idempotent', async () => {
      await seedDemo(app.prisma);
      const allDemoEmails = ['artist@noirsound.com', ...DEMO_ARTISTS.map((a) => a.email)];
      const afterFirst = {
        artists: await app.prisma.user.count({
          where: { email: { in: allDemoEmails } }
        }),
        tracks: await app.prisma.track.count({
          where: { slug: { in: DEMO_TRACK_SLUGS } }
        }),
        playlists: await app.prisma.playlist.count({
          where: { id: DEMO_PLAYLIST_ID }
        }),
        comments: await app.prisma.comment.count({
          where: { id: DEMO_COMMENT_ID }
        }),
        playEvents: await app.prisma.playEvent.count({
          where: { id: DEMO_PLAY_EVENT_ID }
        }),
      };

      await seedDemo(app.prisma);
      const afterSecond = {
        artists: await app.prisma.user.count({
          where: { email: { in: allDemoEmails } }
        }),
        tracks: await app.prisma.track.count({
          where: { slug: { in: DEMO_TRACK_SLUGS } }
        }),
        playlists: await app.prisma.playlist.count({
          where: { id: DEMO_PLAYLIST_ID }
        }),
        comments: await app.prisma.comment.count({
          where: { id: DEMO_COMMENT_ID }
        }),
        playEvents: await app.prisma.playEvent.count({
          where: { id: DEMO_PLAY_EVENT_ID }
        }),
      };

      expect(afterFirst).toEqual({
        artists: DEMO_ARTISTS.length + 1, // 3 demo + 1 primary artist
        tracks: DEMO_TRACKS.length,
        playlists: 1,
        comments: 1,
        playEvents: 1,
      });
      expect(afterSecond).toEqual(afterFirst);
    });

    it('returns recently played tracks with artist user metadata', async () => {
      const response = await supertest(app.server)
        .get('/api/me/recently-played')
        .set('Cookie', listenerCookie);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].track.artist.user.username).toBeTruthy();
    });
  });

  describe('upload runtime', () => {
    it('requires authentication and an artist role', async () => {
      const unauthenticated = await supertest(app.server)
        .post('/api/uploads/track/init')
        .send(validUploadBody());
      expect(unauthenticated.statusCode).toBe(401);

      const listener = await supertest(app.server)
        .post('/api/uploads/track/init')
        .set('Cookie', listenerCookie)
        .send(validUploadBody());
      expect(listener.statusCode).toBe(403);
    });

    it('validates upload metadata', async () => {
      const response = await initializeUpload(validUploadBody({
        title: '',
        copyrightConfirmed: false
      }));
      expect(response.statusCode).toBe(400);
    });

    it('creates exactly one linked Track and Upload with persisted IDs', async () => {
      const beforeTracks = await app.prisma.track.count();
      const beforeUploads = await app.prisma.upload.count();
      const response = await initializeUpload();

      expect(response.statusCode).toBe(200);
      expect(response.body.trackId).toBeTruthy();
      expect(response.body.uploadId).toBeTruthy();

      const upload = await app.prisma.upload.findUnique({
        where: { id: response.body.uploadId },
        include: { track: { include: { artist: true } } }
      });
      expect(upload).toBeTruthy();
      expect(upload.trackId).toBe(response.body.trackId);
      expect(upload.userId).toBe(upload.track.artist.userId);
      expect(upload.status).toBe('UPLOADING');
      expect(upload.track.status).toBe('DRAFT');
      expect(await app.prisma.track.count()).toBe(beforeTracks + 1);
      expect(await app.prisma.upload.count()).toBe(beforeUploads + 1);
    });

    it('rejects completion when the original object is missing', async () => {
      const init = await initializeUpload(validUploadBody({ cover: null }));
      const response = await supertest(app.server)
        .post(`/api/uploads/track/${init.body.uploadId}/complete`)
        .set('Cookie', artistCookie);
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('missing');
    });

    it('verifies objects, queues exactly one job, and returns real status', async () => {
      queueAdd.mockClear();
      const init = await initializeUpload();
      const upload = await app.prisma.upload.findUnique({
        where: { id: init.body.uploadId }
      });
      objectMetadata.set(upload.storageKey, {
        exists: true,
        mimeType: upload.mimeType,
        size: upload.sizeBytes
      });
      objectMetadata.set(upload.coverStorageKey, {
        exists: true,
        mimeType: upload.coverMimeType,
        size: upload.coverSizeBytes
      });

      const complete = await supertest(app.server)
        .post(`/api/uploads/track/${upload.id}/complete`)
        .set('Cookie', artistCookie);
      expect(complete.statusCode).toBe(200);
      expect(complete.body.jobId).toBe(`upload-${upload.id}`);
      expect(queueAdd).toHaveBeenCalledTimes(1);

      const persisted = await app.prisma.upload.findUnique({
        where: { id: upload.id },
        include: { track: true }
      });
      expect(persisted.status).toBe('PROCESSING');
      expect(persisted.track.status).toBe('PROCESSING');

      const status = await supertest(app.server)
        .get(`/api/uploads/track/${upload.id}/status`)
        .set('Cookie', artistCookie);
      expect(status.statusCode).toBe(200);
      expect(status.body.status).toBe('PROCESSING');
      expect(status.body.trackStatus).toBe('PROCESSING');

      const duplicate = await supertest(app.server)
        .post(`/api/uploads/track/${upload.id}/complete`)
        .set('Cookie', artistCookie);
      expect(duplicate.statusCode).toBe(409);
      expect(queueAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('stream and worker failure state', () => {
    it('rejects an unprocessed published track', async () => {
      const track = await app.prisma.track.findFirst({
        where: { processedAudioKey: null }
      });
      const response = await supertest(app.server)
        .get(`/api/tracks/${track.id}/stream`);
      expect(response.statusCode).toBe(404);
    });

    it('redirects a processed published track to a signed URL', async () => {
      const track = await app.prisma.track.findFirst();
      await app.prisma.track.update({
        where: { id: track.id },
        data: {
          status: 'PUBLISHED',
          processedAudioKey: `processed/test/${track.id}/stream.mp3`
        }
      });

      const response = await supertest(app.server)
        .get(`/api/tracks/${track.id}/stream`);
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('http://storage.test/read/');
      expect(storage.getPublicOrSignedUrl).toHaveBeenCalledWith(
        `processed/test/${track.id}/stream.mp3`
      );
    });

    it('stores valid FAILED statuses and a path-safe user error', async () => {
      const init = await initializeUpload(validUploadBody({ cover: null }));
      await app.prisma.$transaction([
        app.prisma.upload.update({
          where: { id: init.body.uploadId },
          data: { status: 'PROCESSING' }
        }),
        app.prisma.track.update({
          where: { id: init.body.trackId },
          data: { status: 'PROCESSING' }
        })
      ]);

      await markProcessingFailed(
        app.prisma,
        init.body.uploadId,
        init.body.trackId,
        new Error('/tmp/private-job/input.wav is invalid'),
        '/tmp/private-job'
      );

      const failed = await app.prisma.upload.findUnique({
        where: { id: init.body.uploadId },
        include: { track: true }
      });
      expect(failed.status).toBe('FAILED');
      expect(failed.track.status).toBe('FAILED');
      expect(failed.processingError).not.toContain('/tmp/private-job');
      expect(failed.errorMessage).not.toContain('/tmp/private-job');
    });
  });

  describe('admin console API', () => {
    it('rejects non-admins and allows admins to read the overview', async () => {
      const forbidden = await supertest(app.server)
        .get('/api/admin/overview')
        .set('Cookie', listenerCookie);
      const allowed = await supertest(app.server)
        .get('/api/admin/overview')
        .set('Cookie', adminCookie);

      expect(forbidden.statusCode).toBe(403);
      expect(allowed.statusCode).toBe(200);
      expect(allowed.body.users.total).toBeGreaterThan(0);
      expect(allowed.body.tracks).toHaveProperty('published');
      expect(allowed.body.system).toHaveProperty('checks');
    });

    it('paginates, searches, and filters users without returning password hashes', async () => {
      const response = await supertest(app.server)
        .get('/api/admin/users?search=listener&role=LISTENER&status=ACTIVE&page=1&pageSize=5')
        .set('Cookie', adminCookie);

      expect(response.statusCode).toBe(200);
      expect(response.body.pagination.pageSize).toBe(5);
      expect(response.body.data.some((user) => user.email === 'listener@noirsound.com')).toBe(true);
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it('suspends a user, revokes sessions, and writes an audit entry', async () => {
      const suffix = Date.now();
      const registered = await supertest(app.server)
        .post('/api/auth/register')
        .send({
          email: `admin_suspend_${suffix}@test.local`,
          password: 'Password123!',
          username: `admin_suspend_${suffix}`,
          displayName: 'Admin Suspend Target'
        });
      const targetId = registered.body.user.id;
      expect(await app.prisma.session.count({ where: { userId: targetId } })).toBe(1);

      const response = await supertest(app.server)
        .post(`/api/admin/users/${targetId}/suspend`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Integration safety test' });

      expect(response.statusCode).toBe(200);
      expect(response.body.user.status).toBe('SUSPENDED');
      expect(await app.prisma.session.count({ where: { userId: targetId } })).toBe(0);
      expect(await app.prisma.auditLog.count({
        where: { action: 'USER_SUSPEND', targetId }
      })).toBe(1);
    });

    it('does not allow the last active admin to be demoted', async () => {
      const admin = await app.prisma.user.findUnique({
        where: { email: 'admin@noirsound.com' }
      });
      const response = await supertest(app.server)
        .post(`/api/admin/users/${admin.id}/set-role`)
        .set('Cookie', adminCookie)
        .send({
          role: 'LISTENER',
          reason: 'Integration safety test',
          confirmation: 'SET_ROLE'
        });

      expect(response.statusCode).toBe(409);
      expect(response.body.error).toBe('ADMIN_LAST_ADMIN');
    });

    it('hides and unhides a published track and removes it from public access', async () => {
      const track = await app.prisma.track.findFirst({ where: { status: 'PUBLISHED' } });
      const hide = await supertest(app.server)
        .post(`/api/admin/tracks/${track.id}/hide`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Integration moderation test' });
      expect(hide.statusCode).toBe(200);
      expect((await supertest(app.server).get(`/api/tracks/${track.id}`)).statusCode).toBe(404);
      expect((await supertest(app.server).get(`/api/tracks/${track.id}/stream`)).statusCode).toBe(404);

      const unhide = await supertest(app.server)
        .post(`/api/admin/tracks/${track.id}/unhide`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Integration restore test' });
      expect(unhide.statusCode).toBe(200);
      expect(await app.prisma.auditLog.count({
        where: { targetType: 'TRACK', targetId: track.id, action: { in: ['TRACK_HIDE', 'TRACK_UNHIDE'] } }
      })).toBe(2);
    });

    it('resolves a report with notes and records the decision and audit log', async () => {
      const track = await app.prisma.track.findFirst({ where: { status: 'PUBLISHED' } });
      const created = await supertest(app.server)
        .post('/api/reports')
        .set('Cookie', listenerCookie)
        .send({
          targetType: 'TRACK',
          targetId: track.id,
          reason: 'OTHER',
          details: 'Admin integration report'
        });
      expect(created.statusCode).toBe(200);

      const response = await supertest(app.server)
        .post(`/api/admin/reports/${created.body.report.id}/resolve`)
        .set('Cookie', adminCookie)
        .send({ notes: 'Reviewed in integration test', targetAction: 'NONE' });
      expect(response.statusCode).toBe(200);
      expect(response.body.report.status).toBe('REVIEWED');
      expect(await app.prisma.auditLog.count({
        where: { action: 'REPORT_RESOLVE', targetId: created.body.report.id }
      })).toBe(1);
    });

    it('caps pagination and returns a redaction-safe system summary', async () => {
      const users = await supertest(app.server)
        .get('/api/admin/users?pageSize=10000')
        .set('Cookie', adminCookie);
      const system = await supertest(app.server)
        .get('/api/admin/system')
        .set('Cookie', adminCookie);

      expect(users.body.pagination.pageSize).toBe(100);
      expect(system.statusCode).toBe(200);
      const serialized = JSON.stringify(system.body);
      expect(serialized).not.toContain(process.env.DATABASE_URL);
      expect(serialized).not.toContain(process.env.JWT_SECRET);
      expect(serialized).not.toContain(process.env.COOKIE_SECRET);
      expect(serialized).not.toMatch(/storageKey|signedUrl/i);
    });
  });
});
