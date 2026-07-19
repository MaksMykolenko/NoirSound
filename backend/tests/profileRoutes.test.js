import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import buildServer from '../src/index.js';
import sessionModule from '../src/lib/session.js';
import profileMedia from '../src/lib/profileMedia.js';

const { hashToken } = sessionModule;
const { bannerKeyFromUploadId, pendingBannerKeyFromUploadId, MAX_BANNER_BYTES } = profileMedia;
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('profile bio and banner routes', () => {
  let app;
  let cookie;
  let userState;
  let objectMetadata;
  let objectHeaders;
  let objectBodies;
  let storage;
  let prisma;
  const previousEnv = {};

  beforeAll(async () => {
    for (const key of ['JWT_SECRET', 'COOKIE_SECRET', 'RATE_LIMIT_MULTIPLIER']) {
      previousEnv[key] = process.env[key];
    }
    process.env.JWT_SECRET = 'profile-route-jwt-secret-at-least-32-characters';
    process.env.COOKIE_SECRET = 'profile-route-cookie-secret-at-least-32-chars';
    process.env.RATE_LIMIT_MULTIPLIER = '20';

    userState = {
      id: 'profile-user-1',
      email: 'profile@example.test',
      passwordHash: 'not-returned',
      username: 'profile_user',
      displayName: 'Profile User',
      avatarUrl: 'https://images.example/avatar.jpg',
      bannerUrl: null,
      bio: 'Initial biography',
      location: 'Warsaw',
      preferredLanguage: 'en',
      role: 'LISTENER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const sid = 'profile-session-1';
    const token = jwt.sign({ userId: userState.id, sid }, process.env.JWT_SECRET, { expiresIn: '1h' });
    cookie = `token=${token}`;

    prisma = {
      session: {
        findUnique: vi.fn(async ({ where }) => where.id === sid ? {
          id: sid,
          userId: userState.id,
          token: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        } : null),
      },
      user: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.id && where.id !== userState.id) return null;
          if (where.username && where.username !== userState.username) return null;
          return { ...userState };
        }),
        findFirst: vi.fn(async ({ where }) => {
          if (where.id) {
            const bannerMatches = Array.isArray(where.bannerUrl?.in)
              ? where.bannerUrl.in.includes(userState.bannerUrl)
              : where.bannerUrl === userState.bannerUrl;
            if (
              where.id !== userState.id
              || where.status !== userState.status
              || !bannerMatches
            ) return null;
            return { id: userState.id, bannerUrl: userState.bannerUrl };
          }
          if (where.username !== userState.username || userState.status !== 'ACTIVE') return null;
          return {
            id: userState.id,
            username: userState.username,
            displayName: userState.displayName,
            avatarUrl: userState.avatarUrl,
            bannerUrl: userState.bannerUrl,
            bio: userState.bio,
            location: userState.location,
            joinedAt: userState.joinedAt,
            artistProfile: null,
          };
        }),
        update: vi.fn(async ({ where, data }) => {
          if (where.id !== userState.id) throw new Error('not found');
          Object.assign(userState, data, { updatedAt: new Date() });
          return { ...userState };
        }),
        updateMany: vi.fn(async ({ where, data }) => {
          if (where.id !== userState.id || where.bannerUrl !== userState.bannerUrl) return { count: 0 };
          Object.assign(userState, data, { updatedAt: new Date() });
          return { count: 1 };
        }),
      },
      artistProfile: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async ({ where }) => where.id === 'artist-profile-1' ? {
          id: 'artist-profile-1',
          userId: userState.id,
          isHidden: false,
          monthlyListeners: 0,
          genres: [],
          socialLinks: null,
          user: {
            displayName: userState.displayName,
            username: userState.username,
            avatarUrl: userState.avatarUrl,
            bannerUrl: userState.bannerUrl,
            bio: userState.bio,
          },
          tracks: [],
          _count: { followers: 0 },
        } : null),
      },
      artistFollow: {
        findMany: vi.fn(async () => [{
          artist: {
            id: 'artist-profile-1',
            userId: userState.id,
            isHidden: false,
            monthlyListeners: 0,
            genres: [],
            user: {
              displayName: userState.displayName,
              username: userState.username,
              avatarUrl: userState.avatarUrl,
              bannerUrl: userState.bannerUrl,
              bio: userState.bio,
            },
            _count: { followers: 0 },
          },
        }]),
      },
    };

    objectMetadata = new Map();
    objectHeaders = new Map();
    objectBodies = new Map();
    storage = {
      createPresignedPutUrl: vi.fn(async (key) => `https://storage.test/put/${encodeURIComponent(key)}`),
      getPublicOrSignedUrl: vi.fn(async (key) => `https://storage.test/get/${encodeURIComponent(key)}?signature=test`),
      getObjectMetadata: vi.fn(async (key) => objectMetadata.get(key) || { exists: false }),
      getObjectPrefix: vi.fn(async (key) => objectHeaders.get(key) || Buffer.alloc(0)),
      getObjectStream: vi.fn(async (key) => objectBodies.get(key) || Buffer.alloc(0)),
      copyObject: vi.fn(async (source, destination) => {
        if (!objectMetadata.has(source)) throw new Error('source missing');
        objectMetadata.set(destination, { ...objectMetadata.get(source) });
        objectHeaders.set(destination, Buffer.from(objectHeaders.get(source) || Buffer.alloc(0)));
        objectBodies.set(destination, Buffer.from(objectBodies.get(source) || Buffer.alloc(0)));
      }),
      deleteObject: vi.fn(async (key) => {
        objectMetadata.delete(key);
        objectHeaders.delete(key);
        objectBodies.delete(key);
      }),
      checkHealth: vi.fn(async () => true),
    };

    app = buildServer({
      prisma,
      storage,
      audioQueue: { add: vi.fn() },
      rateLimitRedis: null,
    });
    await app.ready();
  });

  beforeEach(() => {
    userState.avatarUrl = 'https://images.example/avatar.jpg';
    userState.bannerUrl = null;
    userState.bio = 'Initial biography';
    userState.status = 'ACTIVE';
    objectMetadata.clear();
    objectHeaders.clear();
    objectBodies.clear();
    storage.createPresignedPutUrl.mockClear();
    storage.getPublicOrSignedUrl.mockClear();
    storage.getObjectStream.mockClear();
    storage.copyObject.mockClear();
    storage.deleteObject.mockClear();
    prisma.user.update.mockClear();
    prisma.user.updateMany.mockClear();
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('requires authentication and returns an opaque owner-scoped upload id', async () => {
    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/init',
      payload: { fileName: 'banner.png', mimeType: 'image/png', fileSize: 1024 },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const initialized = await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/init',
      headers: { cookie },
      payload: { fileName: '../../banner.png', mimeType: 'image/png', fileSize: 1024 },
    });
    expect(initialized.statusCode).toBe(200);
    expect(initialized.json()).toMatchObject({ method: 'PUT', maxBytes: MAX_BANNER_BYTES });
    expect(initialized.json().uploadId).toMatch(/\.png$/);
    expect(initialized.json()).not.toHaveProperty('bannerKey');
    const key = bannerKeyFromUploadId(userState.id, initialized.json().uploadId);
    const pendingKey = pendingBannerKeyFromUploadId(userState.id, initialized.json().uploadId);
    expect(key).not.toBe(pendingKey);
    expect(storage.createPresignedPutUrl).toHaveBeenCalledWith(pendingKey, 'image/png', 900, 1024);
  });

  it('rejects unsupported, oversized, and direct banner writes while preserving avatar updates', async () => {
    const unsupported = await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/init',
      headers: { cookie },
      payload: { fileName: 'banner.svg', mimeType: 'image/svg+xml', fileSize: 1024 },
    });
    expect(unsupported.statusCode).toBe(400);

    const oversized = await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/init',
      headers: { cookie },
      payload: { fileName: 'banner.png', mimeType: 'image/png', fileSize: MAX_BANNER_BYTES + 1 },
    });
    expect(oversized.statusCode).toBe(400);

    const directWrite = await app.inject({
      method: 'PUT',
      url: '/api/auth/me',
      headers: { cookie },
      payload: { bannerUrl: 'https://evil.example/tracker.png' },
    });
    expect(directWrite.statusCode).toBe(400);
    expect(directWrite.json().error).toBe('PROFILE_MEDIA_DIRECT_WRITE_FORBIDDEN');
    expect(userState.bannerUrl).toBeNull();

    const directAvatar = await app.inject({
      method: 'PUT',
      url: '/api/auth/me',
      headers: { cookie },
      payload: { avatarUrl: 'https://evil.example/tracker.png' },
    });
    expect(directAvatar.statusCode).toBe(200);
    expect(directAvatar.json().user.avatarUrl).toBe('https://evil.example/tracker.png');
    expect(userState.avatarUrl).toBe('https://evil.example/tracker.png');
  });

  it('normalizes bio and rejects values over 500 characters', async () => {
    const originalDisplayName = userState.displayName;
    const cleared = await app.inject({
      method: 'PUT',
      url: '/api/auth/me',
      headers: { cookie },
      payload: { userId: 'another-user', bio: '   ' },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().user.id).toBe(userState.id);
    expect(cleared.json().user.bio).toBeNull();
    expect(userState.bio).toBeNull();
    expect(userState.displayName).toBe(originalDisplayName);

    const tooLong = await app.inject({
      method: 'PUT',
      url: '/api/auth/me',
      headers: { cookie },
      payload: { bio: 'x'.repeat(501) },
    });
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().error).toBe('PROFILE_BIO_INVALID');
  });

  it('verifies and promotes the upload, persists its stable key, and returns only the public media path', async () => {
    const initialized = await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/init',
      headers: { cookie },
      payload: { fileName: 'banner.png', mimeType: 'image/png', fileSize: 1024 },
    });
    const { uploadId } = initialized.json();
    const key = bannerKeyFromUploadId(userState.id, uploadId);
    const pendingKey = pendingBannerKeyFromUploadId(userState.id, uploadId);
    objectMetadata.set(pendingKey, { exists: true, size: 1024, mimeType: 'image/png' });
    objectHeaders.set(pendingKey, PNG_HEADER);
    objectBodies.set(pendingKey, Buffer.from('banner-body'));

    const completed = await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/complete',
      headers: { cookie },
      payload: { uploadId },
    });
    expect(completed.statusCode).toBe(200);
    expect(userState.bannerUrl).toBe(key);
    expect(completed.json().user.bannerUrl).toBe(`/api/public/profile-banners/${userState.id}/${uploadId}`);
    expect(completed.json().user.bannerUrl).not.toBe(key);
    expect(storage.copyObject).toHaveBeenCalledWith(pendingKey, key);
    expect(storage.deleteObject).toHaveBeenCalledWith(pendingKey);
    expect(objectMetadata.has(pendingKey)).toBe(false);
    expect(objectMetadata.has(key)).toBe(true);

    const current = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().user.bannerUrl).toBe(`/api/public/profile-banners/${userState.id}/${uploadId}`);
    expect(storage.getPublicOrSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects a MIME/signature mismatch and removes only the failed candidate', async () => {
    const initialized = await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/init',
      headers: { cookie },
      payload: { fileName: 'banner.png', mimeType: 'image/png', fileSize: 1024 },
    });
    const { uploadId } = initialized.json();
    const key = bannerKeyFromUploadId(userState.id, uploadId);
    const pendingKey = pendingBannerKeyFromUploadId(userState.id, uploadId);
    objectMetadata.set(pendingKey, { exists: true, size: 1024, mimeType: 'image/png' });
    objectHeaders.set(pendingKey, Buffer.from('%PDF-1.7'));

    const completed = await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/complete',
      headers: { cookie },
      payload: { uploadId },
    });
    expect(completed.statusCode).toBe(400);
    expect(completed.json().error).toBe('PROFILE_BANNER_INVALID');
    expect(userState.bannerUrl).toBeNull();
    expect(storage.deleteObject).toHaveBeenCalledWith(pendingKey);
    expect(storage.deleteObject).not.toHaveBeenCalledWith(key);
  });

  it('returns a safe public profile and removes the owned banner', async () => {
    const initialized = await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/init',
      headers: { cookie },
      payload: { fileName: 'banner.png', mimeType: 'image/png', fileSize: 1024 },
    });
    const { uploadId } = initialized.json();
    const key = bannerKeyFromUploadId(userState.id, uploadId);
    const pendingKey = pendingBannerKeyFromUploadId(userState.id, uploadId);
    objectMetadata.set(pendingKey, { exists: true, size: 1024, mimeType: 'image/png' });
    objectHeaders.set(pendingKey, PNG_HEADER);
    objectBodies.set(pendingKey, Buffer.from('public-banner-body'));
    await app.inject({
      method: 'POST',
      url: '/api/auth/me/banner/complete',
      headers: { cookie },
      payload: { uploadId },
    });

    const publicProfile = await app.inject({
      method: 'GET',
      url: '/api/profiles/profile_user',
    });
    expect(publicProfile.statusCode).toBe(200);
    expect(publicProfile.json().profile).toMatchObject({
      id: userState.id,
      username: 'profile_user',
      artistProfileId: null,
      isCreator: false,
    });
    expect(publicProfile.json().profile.bannerUrl)
      .toBe(`/api/public/profile-banners/${userState.id}/${uploadId}`);
    expect(publicProfile.json().profile).not.toHaveProperty('email');
    expect(publicProfile.json().profile).not.toHaveProperty('role');
    expect(publicProfile.json().profile).not.toHaveProperty('status');

    const publicBanner = await app.inject({
      method: 'GET',
      url: publicProfile.json().profile.bannerUrl,
    });
    expect(publicBanner.statusCode).toBe(200);
    expect(publicBanner.headers['content-type']).toContain('image/png');
    expect(publicBanner.headers['cache-control']).toBe('public, max-age=300');
    expect(publicBanner.body).toBe('public-banner-body');

    const nonCurrentBanner = await app.inject({
      method: 'GET',
      url: `/api/public/profile-banners/${userState.id}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`,
    });
    expect(nonCurrentBanner.statusCode).toBe(404);

    userState.status = 'SUSPENDED';
    const inactiveOwnerBanner = await app.inject({
      method: 'GET',
      url: publicProfile.json().profile.bannerUrl,
    });
    expect(inactiveOwnerBanner.statusCode).toBe(404);
    userState.status = 'ACTIVE';

    const removed = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me/banner',
      headers: { cookie },
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().user.bannerUrl).toBeNull();
    expect(userState.bannerUrl).toBeNull();
    expect(storage.deleteObject).toHaveBeenCalledWith(key);

    const removedBanner = await app.inject({
      method: 'GET',
      url: `/api/public/profile-banners/${userState.id}/${uploadId}`,
    });
    expect(removedBanner.statusCode).toBe(404);
  });

  it('serializes managed banner keys in artist and followed-artist responses', async () => {
    const uploadId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png';
    const key = bannerKeyFromUploadId(userState.id, uploadId);
    userState.bannerUrl = key;

    const artist = await app.inject({
      method: 'GET',
      url: '/api/artists/artist-profile-1',
    });
    expect(artist.statusCode).toBe(200);
    expect(artist.json().artist.user.bannerUrl)
      .toBe(`/api/public/profile-banners/${userState.id}/${uploadId}`);
    expect(artist.json().artist.user.bannerUrl).not.toBe(key);

    const followed = await app.inject({
      method: 'GET',
      url: '/api/me/followed-artists',
      headers: { cookie },
    });
    expect(followed.statusCode).toBe(200);
    expect(followed.json().data[0].user.bannerUrl)
      .toBe(`/api/public/profile-banners/${userState.id}/${uploadId}`);
    expect(followed.json().data[0].user.bannerUrl).not.toBe(key);
  });
});
