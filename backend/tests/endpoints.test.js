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

  describe('playlist API', () => {
    it('enforces authentication and validates playlist metadata', async () => {
      const unauthenticated = await supertest(app.server)
        .post('/api/playlists')
        .send({ name: 'No session' });
      const invalid = await supertest(app.server)
        .post('/api/playlists')
        .set('Cookie', listenerCookie)
        .send({ name: ' ' });
      const csrfRejected = await supertest(app.server)
        .post('/api/playlists')
        .set('Cookie', listenerCookie)
        .set('Origin', 'https://evil.example')
        .send({ name: 'Cross-site playlist' });

      expect(unauthenticated.statusCode).toBe(401);
      expect(invalid.statusCode).toBe(400);
      expect(invalid.body.error).toBe('PLAYLIST_TITLE_REQUIRED');
      expect(csrfRejected.statusCode).toBe(403);
      expect(csrfRejected.body.error).toBe('CSRF_VALIDATION_FAILED');
    });

    it('supports the complete owner lifecycle, ordering, cover verification, and access control', async () => {
      const tracks = await app.prisma.track.findMany({
        where: {
          status: 'PUBLISHED',
          isPublic: true,
          processedAudioKey: { not: null }
        },
        take: 2,
        orderBy: { createdAt: 'asc' }
      });
      expect(tracks).toHaveLength(2);

      const created = await supertest(app.server)
        .post('/api/playlists')
        .set('Cookie', listenerCookie)
        .send({
          name: 'Integration Private Playlist',
          description: 'Owner-controlled fixture',
          isPublic: false
        });
      expect(created.statusCode).toBe(201);
      expect(created.body.playlist.isOwner).toBe(true);
      expect(created.body.playlist.visibility).toBe('PRIVATE');
      const playlistId = created.body.playlist.id;

      const anonymousPrivate = await supertest(app.server).get(`/api/playlists/${playlistId}`);
      const otherUserPrivate = await supertest(app.server)
        .get(`/api/playlists/${playlistId}`)
        .set('Cookie', artistCookie);
      expect(anonymousPrivate.statusCode).toBe(404);
      expect(anonymousPrivate.body.error).toBe('PLAYLIST_PRIVATE');
      expect(otherUserPrivate.statusCode).toBe(403);
      const ownerPrivate = await supertest(app.server)
        .get(`/api/playlists/${playlistId}`)
        .set('Cookie', listenerCookie);
      expect(ownerPrivate.statusCode).toBe(200);

      const forbiddenEdit = await supertest(app.server)
        .patch(`/api/playlists/${playlistId}`)
        .set('Cookie', artistCookie)
        .send({ name: 'Unauthorized edit' });
      expect(forbiddenEdit.statusCode).toBe(403);
      expect(forbiddenEdit.body.error).toBe('PLAYLIST_FORBIDDEN');
      const forbiddenDelete = await supertest(app.server)
        .delete(`/api/playlists/${playlistId}`)
        .set('Cookie', artistCookie);
      expect(forbiddenDelete.statusCode).toBe(403);

      const unavailableTrack = await supertest(app.server)
        .post(`/api/playlists/${playlistId}/tracks`)
        .set('Cookie', listenerCookie)
        .send({ trackId: 'unavailable-track-id' });
      expect(unavailableTrack.statusCode).toBe(404);
      expect(unavailableTrack.body.error).toBe('PLAYLIST_TRACK_NOT_FOUND');

      for (const track of tracks) {
        const added = await supertest(app.server)
          .post(`/api/playlists/${playlistId}/tracks`)
          .set('Cookie', listenerCookie)
          .send({ trackId: track.id });
        expect(added.statusCode).toBe(201);
      }
      const duplicate = await supertest(app.server)
        .post(`/api/playlists/${playlistId}/tracks`)
        .set('Cookie', listenerCookie)
        .send({ trackId: tracks[0].id });
      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.body.error).toBe('PLAYLIST_TRACK_ALREADY_EXISTS');

      const reorderedIds = [tracks[1].id, tracks[0].id];
      const reordered = await supertest(app.server)
        .patch(`/api/playlists/${playlistId}/tracks/reorder`)
        .set('Cookie', listenerCookie)
        .send({ trackIds: reorderedIds });
      expect(reordered.statusCode).toBe(200);
      expect(reordered.body.trackIds).toEqual(reorderedIds);

      const published = await supertest(app.server)
        .patch(`/api/playlists/${playlistId}`)
        .set('Cookie', listenerCookie)
        .send({ name: 'Integration Public Playlist', isPublic: true });
      expect(published.statusCode).toBe(200);
      expect(published.body.playlist.visibility).toBe('PUBLIC');

      const detail = await supertest(app.server).get(`/api/playlists/${playlistId}`);
      expect(detail.statusCode).toBe(200);
      expect(detail.body.playlist.tracks.map((entry) => entry.trackId)).toEqual(reorderedIds);

      const firstSave = await supertest(app.server)
        .post(`/api/playlists/${playlistId}/save`)
        .set('Cookie', artistCookie);
      const duplicateSave = await supertest(app.server)
        .post(`/api/playlists/${playlistId}/save`)
        .set('Cookie', artistCookie);
      expect(firstSave.statusCode).toBe(200);
      expect(duplicateSave.statusCode).toBe(200);
      expect(await app.prisma.playlistLike.count({
        where: { playlistId, userId: (await app.prisma.user.findUnique({ where: { email: 'artist@noirsound.com' } })).id }
      })).toBe(1);
      const artistLibrary = await supertest(app.server)
        .get('/api/playlists/me')
        .set('Cookie', artistCookie);
      expect(artistLibrary.statusCode).toBe(200);
      expect(artistLibrary.body.data.some((item) => item.id === playlistId && item.isSaved)).toBe(true);

      const coverInit = await supertest(app.server)
        .post(`/api/playlists/${playlistId}/cover/init`)
        .set('Cookie', listenerCookie)
        .send({ fileName: 'cover.png', mimeType: 'image/png', fileSize: 1024 });
      expect(coverInit.statusCode).toBe(200);
      objectMetadata.set(coverInit.body.coverKey, {
        exists: true,
        size: 1024,
        mimeType: 'image/png'
      });
      const coverComplete = await supertest(app.server)
        .post(`/api/playlists/${playlistId}/cover/complete`)
        .set('Cookie', listenerCookie)
        .send({ coverKey: coverInit.body.coverKey });
      expect(coverComplete.statusCode).toBe(200);
      expect(coverComplete.body.playlist.hasCoverImage).toBe(true);

      const removed = await supertest(app.server)
        .delete(`/api/playlists/${playlistId}/tracks/${tracks[0].id}`)
        .set('Cookie', listenerCookie);
      expect(removed.statusCode).toBe(204);

      const unsaved = await supertest(app.server)
        .delete(`/api/playlists/${playlistId}/save`)
        .set('Cookie', artistCookie);
      expect(unsaved.statusCode).toBe(200);

      const deleted = await supertest(app.server)
        .delete(`/api/playlists/${playlistId}`)
        .set('Cookie', listenerCookie);
      expect(deleted.statusCode).toBe(204);
      expect((await supertest(app.server).get(`/api/playlists/${playlistId}`)).statusCode).toBe(404);
    });

    it('returns addedAt/duration/album-release/isLiked on the detail payload and hides an unavailable track from non-owners while the owner still sees it', async () => {
      const tracks = await app.prisma.track.findMany({
        where: {
          status: 'PUBLISHED',
          isPublic: true,
          processedAudioKey: { not: null }
        },
        take: 2,
        orderBy: { createdAt: 'asc' }
      });
      expect(tracks).toHaveLength(2);
      const expectedDuration = tracks.reduce(
        (total, track) => total + Number(track.durationSeconds || track.duration || 0),
        0
      );

      const created = await supertest(app.server)
        .post('/api/playlists')
        .set('Cookie', listenerCookie)
        .send({ name: 'Detail Table Fixture', isPublic: true });
      expect(created.statusCode).toBe(201);
      const playlistId = created.body.playlist.id;
      const ownerId = created.body.playlist.creatorId;

      const addedFirst = await supertest(app.server)
        .post(`/api/playlists/${playlistId}/tracks`)
        .set('Cookie', listenerCookie)
        .send({ trackId: tracks[0].id });
      expect(addedFirst.statusCode).toBe(201);
      expect(addedFirst.body.entry.addedAt).toBeTruthy();
      expect(addedFirst.body.entry.playlistTrackId).toBe(addedFirst.body.entry.id);
      expect(addedFirst.body.entry.addedBy.id).toBe(ownerId);
      expect(addedFirst.body.entry.track.isAvailable).toBe(true);
      // No real Album usage exists anywhere in this app yet (see the audit),
      // and this seeded track was not published via a playlist/release
      // batch, so both fallback levels are null -- the client renders
      // "Single". This should not regress into a thrown error or a fake value.
      expect(addedFirst.body.entry.track.albumTitle).toBeNull();
      expect(addedFirst.body.entry.track.releaseTitle).toBeNull();

      const addedSecond = await supertest(app.server)
        .post(`/api/playlists/${playlistId}/tracks`)
        .set('Cookie', listenerCookie)
        .send({ trackId: tracks[1].id });
      expect(addedSecond.statusCode).toBe(201);

      await supertest(app.server).post(`/api/tracks/${tracks[0].id}/like`).set('Cookie', listenerCookie);

      const ownerView = await supertest(app.server)
        .get(`/api/playlists/${playlistId}`)
        .set('Cookie', listenerCookie);
      expect(ownerView.statusCode).toBe(200);
      expect(ownerView.body.playlist.trackCount).toBe(2);
      expect(ownerView.body.playlist.durationSeconds).toBe(expectedDuration);
      expect(ownerView.body.playlist.canReorder).toBe(true);
      const likedRow = ownerView.body.playlist.tracks.find((entry) => entry.trackId === tracks[0].id);
      expect(likedRow.track.isLiked).toBe(true);

      // Simulate a track becoming unavailable (e.g. moderation) after it was
      // already sitting in an otherwise-public playlist.
      await app.prisma.track.update({ where: { id: tracks[1].id }, data: { status: 'HIDDEN' } });

      try {
        const anonymousView = await supertest(app.server).get(`/api/playlists/${playlistId}`);
        expect(anonymousView.statusCode).toBe(200);
        const hiddenRowForStranger = anonymousView.body.playlist.tracks.find((entry) => entry.trackId === tracks[1].id);
        expect(hiddenRowForStranger.track).toEqual({ id: tracks[1].id, isAvailable: false });
        expect(JSON.stringify(hiddenRowForStranger)).not.toContain(tracks[1].title);
        // Count/duration stay accurate for every viewer regardless of what
        // that viewer is individually allowed to see per row.
        expect(anonymousView.body.playlist.trackCount).toBe(2);
        expect(anonymousView.body.playlist.durationSeconds).toBe(expectedDuration);
        const stillVisibleRow = anonymousView.body.playlist.tracks.find((entry) => entry.trackId === tracks[0].id);
        expect(stillVisibleRow.track.title).toBe(tracks[0].title);
        expect(stillVisibleRow.track.isLiked).toBe(false);

        const otherLoggedInView = await supertest(app.server)
          .get(`/api/playlists/${playlistId}`)
          .set('Cookie', artistCookie);
        const hiddenRowForOtherUser = otherLoggedInView.body.playlist.tracks.find((entry) => entry.trackId === tracks[1].id);
        expect(hiddenRowForOtherUser.track).toEqual({ id: tracks[1].id, isAvailable: false });

        const ownerViewAfterHide = await supertest(app.server)
          .get(`/api/playlists/${playlistId}`)
          .set('Cookie', listenerCookie);
        const hiddenRowForOwner = ownerViewAfterHide.body.playlist.tracks.find((entry) => entry.trackId === tracks[1].id);
        expect(hiddenRowForOwner.track.title).toBe(tracks[1].title);
        expect(hiddenRowForOwner.track.isAvailable).toBe(false);
      } finally {
        await app.prisma.track.update({ where: { id: tracks[1].id }, data: { status: 'PUBLISHED' } });
        await supertest(app.server).delete(`/api/playlists/${playlistId}`).set('Cookie', listenerCookie);
      }
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

  describe('lyrics API and upload integration', () => {
    async function createLyricsTrack(overrides = {}) {
      const artist = await app.prisma.artistProfile.findFirst({
        where: { user: { email: 'artist@noirsound.com' } }
      });
      return app.prisma.track.create({
        data: {
          artistId: artist.id,
          title: `Lyrics Fixture ${Date.now()}-${Math.random()}`,
          status: 'PUBLISHED',
          isPublic: true,
          lyricsText: 'First original line\n\nSecond original line',
          lyricsType: 'PLAIN',
          lyricsLanguage: 'en',
          lyricsRightsConfirmed: true,
          lyricsUpdatedAt: new Date(),
          ...overrides
        }
      });
    }

    it('keeps single upload lyrics optional and rejects lyrics without separate rights', async () => {
      const withoutLyrics = await initializeUpload(validUploadBody({ cover: null }));
      expect(withoutLyrics.statusCode).toBe(200);
      const plainTrack = await app.prisma.track.findUnique({ where: { id: withoutLyrics.body.trackId } });
      expect(plainTrack.lyricsText).toBeNull();
      expect(plainTrack.lyricsType).toBe('NONE');
      expect(plainTrack.lyricsRightsConfirmed).toBe(false);

      const missingRights = await initializeUpload(validUploadBody({
        cover: null,
        lyricsText: 'Original words',
        lyricsType: 'PLAIN',
        lyricsLanguage: 'en',
        lyricsRightsConfirmed: false
      }));
      expect(missingRights.statusCode).toBe(400);
      expect(missingRights.body.error).toBe('LYRICS_RIGHTS_REQUIRED');
    });

    it('persists rights-confirmed lyrics during single upload initialization', async () => {
      const response = await initializeUpload(validUploadBody({
        cover: null,
        lyricsText: 'Verse one\r\n\r\nVerse two',
        lyricsType: 'PLAIN',
        lyricsLanguage: 'uk',
        lyricsRightsConfirmed: true
      }));
      expect(response.statusCode).toBe(200);
      const track = await app.prisma.track.findUnique({ where: { id: response.body.trackId } });
      expect(track.lyricsText).toBe('Verse one\n\nVerse two');
      expect(track.lyricsType).toBe('PLAIN');
      expect(track.lyricsLanguage).toBe('uk');
      expect(track.lyricsRightsConfirmed).toBe(true);
      expect(track.lyricsUpdatedAt).toBeInstanceOf(Date);
    });

    it('returns public lyrics lazily while list/detail payloads expose only flags', async () => {
      const track = await createLyricsTrack();
      const lyrics = await supertest(app.server).get(`/api/tracks/${track.id}/lyrics`);
      const detail = await supertest(app.server).get(`/api/tracks/${track.id}`);
      const list = await supertest(app.server).get('/api/tracks');

      expect(lyrics.statusCode).toBe(200);
      expect(lyrics.body).toMatchObject({
        trackId: track.id,
        hasLyrics: true,
        lyricsType: 'PLAIN',
        lyricsText: 'First original line\n\nSecond original line'
      });
      expect(detail.body.track).toMatchObject({ hasLyrics: true, lyricsType: 'PLAIN' });
      expect(detail.body.track).not.toHaveProperty('lyricsText');
      const listed = list.body.data.find((entry) => entry.id === track.id);
      expect(listed).toMatchObject({ hasLyrics: true, lyricsType: 'PLAIN' });
      expect(JSON.stringify(list.body)).not.toContain('First original line');
    });

    it('returns a clean empty payload and hides non-public lyrics', async () => {
      const noLyrics = await createLyricsTrack({
        lyricsText: null,
        lyricsType: 'NONE',
        lyricsLanguage: null,
        lyricsRightsConfirmed: false,
        lyricsUpdatedAt: null
      });
      const empty = await supertest(app.server).get(`/api/tracks/${noLyrics.id}/lyrics`);
      expect(empty.statusCode).toBe(200);
      expect(empty.body).toEqual({ trackId: noLyrics.id, hasLyrics: false });

      for (const updates of [
        { status: 'HIDDEN' },
        { status: 'DRAFT' },
        { status: 'PUBLISHED', isPublic: false }
      ]) {
        const hidden = await createLyricsTrack(updates);
        const response = await supertest(app.server).get(`/api/tracks/${hidden.id}/lyrics`);
        expect(response.statusCode).toBe(404);
        expect(response.body.error).toBe('LYRICS_NOT_AVAILABLE');
      }
    });

    it('allows the owner to edit, blocks non-owners, and lets admins remove with audit', async () => {
      const track = await createLyricsTrack();
      const blocked = await supertest(app.server)
        .patch(`/api/tracks/${track.id}/lyrics`)
        .set('Cookie', listenerCookie)
        .send({
          lyricsText: 'Not mine',
          lyricsType: 'PLAIN',
          lyricsRightsConfirmed: true
        });
      expect(blocked.statusCode).toBe(403);

      const edited = await supertest(app.server)
        .patch(`/api/tracks/${track.id}/lyrics`)
        .set('Cookie', artistCookie)
        .send({
          lyricsText: 'Owner revision',
          lyricsType: 'PLAIN',
          lyricsLanguage: 'pl',
          lyricsRightsConfirmed: true
        });
      expect(edited.statusCode).toBe(200);
      expect(edited.body).toMatchObject({
        id: track.id,
        hasLyrics: true,
        lyricsType: 'PLAIN',
        lyricsLanguage: 'pl'
      });

      const managed = await supertest(app.server)
        .get(`/api/tracks/${track.id}/lyrics/manage`)
        .set('Cookie', artistCookie);
      expect(managed.statusCode).toBe(200);
      expect(managed.body.lyricsText).toBe('Owner revision');

      const removed = await supertest(app.server)
        .post(`/api/admin/tracks/${track.id}/lyrics/remove`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Confirmed lyrics moderation fixture.' });
      expect(removed.statusCode).toBe(200);
      const persisted = await app.prisma.track.findUnique({ where: { id: track.id } });
      expect(persisted.lyricsText).toBeNull();
      expect(persisted.lyricsType).toBe('NONE');
      expect(persisted.lyricsRightsConfirmed).toBe(false);
      expect(await app.prisma.auditLog.count({
        where: {
          targetType: 'TRACK',
          targetId: track.id,
          action: 'TRACK_LYRICS_MODERATED'
        }
      })).toBe(1);
    });
  });

  describe('batch upload studio API', () => {
    function batchFiles(count = 2) {
      return Array.from({ length: count }, (_, index) => ({
        clientId: `batch-${Date.now()}-${index}`,
        fileName: `batch_track_${index + 1}.wav`,
        fileSize: 4096 + index,
        mimeType: 'audio/wav'
      }));
    }

    async function initializeBatch(files = batchFiles(), mode = 'MIXED', extra = {}) {
      return supertest(app.server)
        .post('/api/uploads/batch/init')
        .set('Cookie', artistCookie)
        .send({ files, mode, ...extra });
    }

    async function completeItemMetadata(batchId, item, target, playlistOrder = null) {
      return supertest(app.server)
        .patch(`/api/uploads/batch/${batchId}/items/${item.id}`)
        .set('Cookie', artistCookie)
        .send({
          title: item.title,
          primaryArtistName: item.primaryArtistName,
          genre: 'electronic',
          tags: ['batch'],
          description: 'Batch integration fixture',
          explicit: false,
          visibility: 'PUBLIC',
          copyrightConfirmed: true,
          target,
          playlistOrder
        });
    }

    it('enforces authentication, artist access, limits, ownership, and draft-only Track creation', async () => {
      const files = batchFiles();
      const unauthenticated = await supertest(app.server)
        .post('/api/uploads/batch/init')
        .send({ files, mode: 'MIXED' });
      expect(unauthenticated.statusCode).toBe(401);

      const listener = await supertest(app.server)
        .post('/api/uploads/batch/init')
        .set('Cookie', listenerCookie)
        .send({ files, mode: 'MIXED' });
      expect(listener.statusCode).toBe(403);

      const tooMany = await initializeBatch(batchFiles(21));
      expect(tooMany.statusCode).toBe(400);

      const beforeTracks = await app.prisma.track.count();
      const created = await initializeBatch(files);
      expect(created.statusCode).toBe(201);
      expect(created.body.uploads).toHaveLength(2);
      expect(await app.prisma.track.count()).toBe(beforeTracks);

      const own = await supertest(app.server)
        .get(`/api/uploads/batch/${created.body.batchId}`)
        .set('Cookie', artistCookie);
      expect(own.statusCode).toBe(200);
      expect(own.body.batch.items).toHaveLength(2);
      expect(JSON.stringify(own.body)).not.toMatch(/storageKey|audioUploadUrl/);

      const forbidden = await supertest(app.server)
        .get(`/api/uploads/batch/${created.body.batchId}`)
        .set('Cookie', listenerCookie);
      expect(forbidden.statusCode).toBe(403);

      const first = own.body.batch.items[0];
      const invalidGenre = await supertest(app.server)
        .patch(`/api/uploads/batch/${created.body.batchId}/items/${first.id}`)
        .set('Cookie', artistCookie)
        .send({ genre: 'not-a-real-genre' });
      expect(invalidGenre.statusCode).toBe(400);

      await completeItemMetadata(created.body.batchId, first, 'PLAYLIST', 1);
      const missingTitle = await supertest(app.server)
        .patch(`/api/uploads/batch/${created.body.batchId}/playlist`)
        .set('Cookie', artistCookie)
        .send({ title: '' });
      expect(missingTitle.statusCode).toBe(400);
    });

    it('replays the same client batch id without duplicate batches or items', async () => {
      const files = batchFiles();
      const clientBatchId = `integration-idempotency-${Date.now()}`;
      const before = await app.prisma.uploadBatch.count();

      const first = await initializeBatch(files, 'MIXED', { clientBatchId });
      const replay = await initializeBatch(files, 'MIXED', { clientBatchId });

      expect(first.statusCode).toBe(201);
      expect(replay.statusCode).toBe(200);
      expect(replay.body.idempotentReplay).toBe(true);
      expect(replay.body.batchId).toBe(first.body.batchId);
      expect(await app.prisma.uploadBatch.count()).toBe(before + 1);
      expect(await app.prisma.uploadBatchItem.count({
        where: { batchId: first.body.batchId }
      })).toBe(files.length);
    });

    it('completes idempotently, publishes singles and an ordered playlist once, and creates no plays', async () => {
      queueAdd.mockClear();
      const beforePlayEvents = await app.prisma.playEvent.count();
      const created = await initializeBatch();
      expect(created.statusCode).toBe(201);
      let state = (await supertest(app.server)
        .get(`/api/uploads/batch/${created.body.batchId}`)
        .set('Cookie', artistCookie)).body.batch;

      await completeItemMetadata(created.body.batchId, state.items[0], 'SINGLE');
      await completeItemMetadata(created.body.batchId, state.items[1], 'PLAYLIST', 1);
      const playlistDraft = await supertest(app.server)
        .patch(`/api/uploads/batch/${created.body.batchId}/playlist`)
        .set('Cookie', artistCookie)
        .send({
          title: 'Integration Batch Playlist',
          description: 'Ordered release fixture',
          visibility: 'PUBLIC',
          tags: ['integration'],
          orderedItemIds: [state.items[1].id]
        });
      expect(playlistDraft.statusCode).toBe(200);

      const persistedBeforeComplete = await app.prisma.uploadBatch.findUnique({
        where: { id: created.body.batchId },
        include: { items: { include: { upload: true } } }
      });
      for (const item of persistedBeforeComplete.items) {
        objectMetadata.set(item.upload.storageKey, {
          exists: true,
          mimeType: item.upload.mimeType,
          size: item.upload.sizeBytes
        });
      }

      const complete = await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/complete`)
        .set('Cookie', artistCookie);
      expect(complete.statusCode).toBe(200);
      expect(complete.body.items.every((entry) => entry.status === 'PROCESSING')).toBe(true);
      expect(queueAdd).toHaveBeenCalledTimes(2);

      const duplicateComplete = await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/complete`)
        .set('Cookie', artistCookie);
      expect(duplicateComplete.statusCode).toBe(200);
      expect(queueAdd).toHaveBeenCalledTimes(2);

      const processing = await app.prisma.uploadBatch.findUnique({
        where: { id: created.body.batchId },
        include: { items: { include: { upload: true, track: true } } }
      });
      for (const [index, item] of processing.items.entries()) {
        await app.prisma.$transaction([
          app.prisma.track.update({
            where: { id: item.trackId },
            data: {
              status: 'DRAFT',
              processedAudioKey: `processed/test/${item.trackId}.mp3`,
              durationSeconds: 120 + index
            }
          }),
          app.prisma.upload.update({ where: { id: item.uploadId }, data: { status: 'READY' } }),
          app.prisma.uploadBatchItem.update({ where: { id: item.id }, data: { status: 'READY' } })
        ]);
      }
      await app.prisma.uploadBatch.update({ where: { id: created.body.batchId }, data: { status: 'READY' } });

      const publish = await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/publish`)
        .set('Cookie', artistCookie)
        .send({ allowPartial: false });
      expect(publish.statusCode).toBe(200);
      expect(publish.body.batch.status).toBe('PUBLISHED');
      expect(publish.body.playlistId).toBeTruthy();
      expect(publish.body.tracks).toHaveLength(2);

      const playlist = await app.prisma.playlist.findUnique({
        where: { id: publish.body.playlistId },
        include: { tracks: { orderBy: { order: 'asc' } } }
      });
      expect(playlist.name).toBe('Integration Batch Playlist');
      expect(playlist.tracks).toHaveLength(1);
      expect(playlist.tracks[0].order).toBe(1);

      const duplicatePublish = await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/publish`)
        .set('Cookie', artistCookie)
        .send({ allowPartial: false });
      expect(duplicatePublish.statusCode).toBe(200);
      expect(duplicatePublish.body.playlistId).toBe(publish.body.playlistId);
      expect(await app.prisma.playlistTrack.count({
        where: { playlistId: publish.body.playlistId }
      })).toBe(1);
      expect(await app.prisma.playEvent.count()).toBe(beforePlayEvents);
    });

    it('retries one failed item without creating another Track', async () => {
      queueAdd.mockClear();
      const created = await initializeBatch(batchFiles(1));
      let state = (await supertest(app.server)
        .get(`/api/uploads/batch/${created.body.batchId}`)
        .set('Cookie', artistCookie)).body.batch;
      await completeItemMetadata(created.body.batchId, state.items[0], 'SINGLE');
      const persisted = await app.prisma.uploadBatch.findUnique({
        where: { id: created.body.batchId },
        include: { items: { include: { upload: true } } }
      });
      objectMetadata.set(persisted.items[0].upload.storageKey, {
        exists: true,
        mimeType: persisted.items[0].upload.mimeType,
        size: persisted.items[0].upload.sizeBytes
      });
      await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/complete`)
        .set('Cookie', artistCookie);

      const initialized = await app.prisma.uploadBatchItem.findFirst({
        where: { batchId: created.body.batchId },
        include: { track: true, upload: true }
      });
      await app.prisma.$transaction([
        app.prisma.track.update({ where: { id: initialized.trackId }, data: { status: 'FAILED' } }),
        app.prisma.upload.update({ where: { id: initialized.uploadId }, data: { status: 'FAILED' } }),
        app.prisma.uploadBatchItem.update({ where: { id: initialized.id }, data: { status: 'FAILED' } })
      ]);
      const beforeTracks = await app.prisma.track.count();
      const retry = await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/items/${initialized.id}/retry`)
        .set('Cookie', artistCookie);
      expect(retry.statusCode).toBe(200);
      expect(retry.body.status).toBe('PROCESSING');
      expect(await app.prisma.track.count()).toBe(beforeTracks);
      const sameItem = await app.prisma.uploadBatchItem.findUnique({ where: { id: initialized.id } });
      expect(sameItem.trackId).toBe(initialized.trackId);
    });

    it('publishes only ready items when partial publish is explicit and keeps private tracks owner-only', async () => {
      const beforePlayEvents = await app.prisma.playEvent.count();
      const created = await initializeBatch();
      const state = (await supertest(app.server)
        .get(`/api/uploads/batch/${created.body.batchId}`)
        .set('Cookie', artistCookie)).body.batch;

      await supertest(app.server)
        .patch(`/api/uploads/batch/${created.body.batchId}/items/${state.items[0].id}`)
        .set('Cookie', artistCookie)
        .send({
          title: state.items[0].title,
          primaryArtistName: state.items[0].primaryArtistName,
          genre: 'electronic',
          tags: ['private'],
          copyrightConfirmed: true,
          visibility: 'PRIVATE',
          target: 'SINGLE'
        });
      await completeItemMetadata(created.body.batchId, state.items[1], 'SINGLE');

      const beforeComplete = await app.prisma.uploadBatch.findUnique({
        where: { id: created.body.batchId },
        include: { items: { include: { upload: true } } }
      });
      for (const item of beforeComplete.items) {
        objectMetadata.set(item.upload.storageKey, {
          exists: true,
          mimeType: item.upload.mimeType,
          size: item.upload.sizeBytes
        });
      }
      await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/complete`)
        .set('Cookie', artistCookie);

      const processing = await app.prisma.uploadBatch.findUnique({
        where: { id: created.body.batchId },
        include: { items: { orderBy: { createdAt: 'asc' } } }
      });
      const [readyItem, failedItem] = processing.items;
      await app.prisma.$transaction([
        app.prisma.track.update({
          where: { id: readyItem.trackId },
          data: {
            status: 'DRAFT',
            processedAudioKey: `processed/test/${readyItem.trackId}.mp3`,
            durationSeconds: 90
          }
        }),
        app.prisma.upload.update({ where: { id: readyItem.uploadId }, data: { status: 'READY' } }),
        app.prisma.uploadBatchItem.update({ where: { id: readyItem.id }, data: { status: 'READY' } }),
        app.prisma.track.update({ where: { id: failedItem.trackId }, data: { status: 'FAILED' } }),
        app.prisma.upload.update({
          where: { id: failedItem.uploadId },
          data: { status: 'FAILED', errorMessage: 'Integration failure fixture.' }
        }),
        app.prisma.uploadBatchItem.update({
          where: { id: failedItem.id },
          data: { status: 'FAILED', errorCode: 'PROCESSING_FAILED', errorMessage: 'Integration failure fixture.' }
        }),
        app.prisma.uploadBatch.update({
          where: { id: created.body.batchId },
          data: { status: 'PARTIAL_READY' }
        })
      ]);

      const strict = await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/publish`)
        .set('Cookie', artistCookie)
        .send({ allowPartial: false });
      expect(strict.statusCode).toBe(409);

      const partial = await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/publish`)
        .set('Cookie', artistCookie)
        .send({ allowPartial: true });
      expect(partial.statusCode).toBe(200);
      expect(partial.body.partial).toBe(true);
      expect(partial.body.batch.status).toBe('PARTIAL_READY');

      const persistedReady = await app.prisma.track.findUnique({ where: { id: readyItem.trackId } });
      const persistedFailed = await app.prisma.track.findUnique({ where: { id: failedItem.trackId } });
      expect(persistedReady.status).toBe('PUBLISHED');
      expect(persistedReady.isPublic).toBe(false);
      expect(persistedFailed.status).toBe('FAILED');

      const anonymous = await supertest(app.server).get(`/api/tracks/${readyItem.trackId}`);
      const owner = await supertest(app.server)
        .get(`/api/tracks/${readyItem.trackId}`)
        .set('Cookie', artistCookie);
      const catalog = await supertest(app.server).get('/api/tracks');
      expect(anonymous.statusCode).toBe(404);
      expect(owner.statusCode).toBe(200);
      expect(catalog.body.data.some((track) => track.id === readyItem.trackId)).toBe(false);
      expect(await app.prisma.playEvent.count()).toBe(beforePlayEvents);
    });

    it('persists batch draft lyrics and keeps them through processing and publish', async () => {
      const created = await initializeBatch(batchFiles(1));
      const state = (await supertest(app.server)
        .get(`/api/uploads/batch/${created.body.batchId}`)
        .set('Cookie', artistCookie)).body.batch;
      const item = state.items[0];
      const updated = await supertest(app.server)
        .patch(`/api/uploads/batch/${created.body.batchId}/items/${item.id}`)
        .set('Cookie', artistCookie)
        .send({
          title: item.title,
          primaryArtistName: item.primaryArtistName,
          genre: 'electronic',
          tags: ['lyrics'],
          copyrightConfirmed: true,
          visibility: 'PUBLIC',
          target: 'SINGLE',
          lyricsText: 'Batch line one\r\nBatch line two',
          lyricsType: 'PLAIN',
          lyricsLanguage: 'en',
          lyricsRightsConfirmed: true
        });
      expect(updated.statusCode).toBe(200);
      expect(updated.body.batch.items[0]).toMatchObject({
        hasLyrics: true,
        lyricsText: 'Batch line one\nBatch line two',
        lyricsType: 'PLAIN',
        lyricsLanguage: 'en',
        lyricsRightsConfirmed: true
      });

      const beforeComplete = await app.prisma.uploadBatch.findUnique({
        where: { id: created.body.batchId },
        include: { items: { include: { upload: true } } }
      });
      const persistedItem = beforeComplete.items[0];
      objectMetadata.set(persistedItem.upload.storageKey, {
        exists: true,
        mimeType: persistedItem.upload.mimeType,
        size: persistedItem.upload.sizeBytes
      });
      const complete = await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/complete`)
        .set('Cookie', artistCookie);
      expect(complete.statusCode).toBe(200);

      const processing = await app.prisma.uploadBatchItem.findUnique({
        where: { id: item.id },
        include: { track: true }
      });
      expect(processing.track).toMatchObject({
        lyricsText: 'Batch line one\nBatch line two',
        lyricsType: 'PLAIN',
        lyricsLanguage: 'en',
        lyricsRightsConfirmed: true
      });

      await app.prisma.$transaction([
        app.prisma.track.update({
          where: { id: processing.trackId },
          data: {
            status: 'DRAFT',
            processedAudioKey: `processed/test/${processing.trackId}.mp3`,
            durationSeconds: 90
          }
        }),
        app.prisma.upload.update({ where: { id: processing.uploadId }, data: { status: 'READY' } }),
        app.prisma.uploadBatchItem.update({ where: { id: processing.id }, data: { status: 'READY' } }),
        app.prisma.uploadBatch.update({ where: { id: created.body.batchId }, data: { status: 'READY' } })
      ]);

      const publish = await supertest(app.server)
        .post(`/api/uploads/batch/${created.body.batchId}/publish`)
        .set('Cookie', artistCookie)
        .send({ allowPartial: false });
      expect(publish.statusCode).toBe(200);
      const published = await app.prisma.track.findUnique({ where: { id: processing.trackId } });
      expect(published).toMatchObject({
        status: 'PUBLISHED',
        lyricsText: 'Batch line one\nBatch line two',
        lyricsType: 'PLAIN',
        lyricsLanguage: 'en',
        lyricsRightsConfirmed: true
      });
      expect(published.lyricsUpdatedAt).toBeInstanceOf(Date);
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
