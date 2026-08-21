import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import desktopPresence from '../src/lib/desktopPresence.js';
import redisPresence from '../src/lib/redisPresence.js';
import buildServer from '../src/index.js';
import sessionModule from '../src/lib/session.js';

const { hashToken } = sessionModule;

const {
  generateUserCode,
  generateDeviceCode,
  generateRefreshToken,
  hashRefreshToken,
  signDeviceAccessToken,
  verifyDeviceAccessToken,
  truncateString,
  formatAuthoritativeTrack
} = desktopPresence;

const { RedisPresenceManager } = redisPresence;

describe('Desktop Presence Utilities', () => {
  const secret = 'test-secret-at-least-32-chars-long-for-tests-12345';

  it('generates a valid formatted user code', () => {
    const code = generateUserCode();
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    expect(code).not.toContain('0');
    expect(code).not.toContain('O');
    expect(code).not.toContain('1');
    expect(code).not.toContain('I');
  });

  it('generates high entropy device code and refresh token', () => {
    const deviceCode1 = generateDeviceCode();
    const deviceCode2 = generateDeviceCode();
    expect(deviceCode1).toHaveLength(64);
    expect(deviceCode2).toHaveLength(64);
    expect(deviceCode1).not.toEqual(deviceCode2);

    const refreshToken = generateRefreshToken();
    expect(refreshToken).toHaveLength(64);
  });

  it('hashes refresh token deterministically with sha256', () => {
    const token = 'sample-refresh-token-1234';
    const hash1 = hashRefreshToken(token);
    const hash2 = hashRefreshToken(token);
    expect(hash1).toEqual(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('signs and verifies device access token with scopes', () => {
    const userId = 'user-uuid-1';
    const deviceId = 'device-uuid-1';

    const token = signDeviceAccessToken(userId, deviceId, secret);
    expect(typeof token).toBe('string');

    const decoded = verifyDeviceAccessToken(token, secret);
    expect(decoded).not.toBeNull();
    expect(decoded.sub).toBe(userId);
    expect(decoded.deviceId).toBe(deviceId);
    expect(decoded.type).toBe('desktop_device_access');
    expect(decoded.scopes).toContain('desktop_presence:read');
    expect(decoded.scopes).toContain('desktop_device:heartbeat');
  });

  it('rejects invalid or tampered access token', () => {
    const token = signDeviceAccessToken('user-1', 'device-1', secret);
    const tampered = token.slice(0, -4) + 'abcd';
    expect(verifyDeviceAccessToken(tampered, secret)).toBeNull();
    expect(verifyDeviceAccessToken('random-string', secret)).toBeNull();
  });

  it('safely truncates long unicode strings', () => {
    const longString = '🔥'.repeat(200);
    const truncated = truncateString(longString, 50);
    expect(Array.from(truncated)).toHaveLength(50);
  });

  it('formats authoritative track metadata and clamps position', () => {
    const track = {
      id: 'track-123',
      title: 'Midnight Dreams',
      durationSeconds: 210,
      coverUrl: 'https://noirsound.co/uploads/cover.jpg',
      primaryArtistName: 'Noir Artist',
      album: { title: 'Noir Album' }
    };

    const formatted = formatAuthoritativeTrack(track, 45000, 'https://noirsound.co');
    expect(formatted.id).toBe('track-123');
    expect(formatted.title).toBe('Midnight Dreams');
    expect(formatted.artistName).toBe('Noir Artist');
    expect(formatted.albumTitle).toBe('Noir Album');
    expect(formatted.durationMs).toBe(210000);
    expect(formatted.positionMs).toBe(45000);
    expect(formatted.coverUrl).toBe('https://noirsound.co/uploads/cover.jpg');
    expect(formatted.shareUrl).toBe('https://noirsound.co/track/track-123');

    // Test position clamp beyond duration + 10s
    const overClamped = formatAuthoritativeTrack(track, 300000, 'https://noirsound.co');
    expect(overClamped.positionMs).toBe(220000); // 210000 + 10000
  });

  it('falls back to stable internal cover route if coverUrl is missing or untrusted host', () => {
    const track = {
      id: 'track-456',
      title: 'Dark Alley',
      durationSeconds: 180,
      coverUrl: 'http://malicious-external-site.com/evil.jpg',
      artist: { user: { displayName: 'Shadow Singer' } }
    };

    const formatted = formatAuthoritativeTrack(track, 0, 'https://noirsound.co');
    expect(formatted.coverUrl).toBe('https://noirsound.co/api/public/covers/track-456');
    expect(formatted.artistName).toBe('Shadow Singer');
  });
});

describe('Desktop Connect Server API Routes', () => {
  let app;
  let presenceManager;
  let authCookie;

  const mockUser = {
    id: 'user-test-123',
    username: 'noiruser',
    displayName: 'Noir User',
    email: 'noir@example.com',
    status: 'ACTIVE',
    role: 'LISTENER',
    discordPresenceEnabled: true,
    discordPresenceShowCover: true,
    discordPresenceShowTimer: true
  };

  const mockTrack = {
    id: 'track-test-789',
    title: 'Neon Skyline',
    durationSeconds: 195,
    status: 'PUBLISHED',
    isPublic: true,
    coverUrl: 'https://noirsound.co/covers/neon.jpg',
    primaryArtistName: 'Synth Master',
    album: { title: 'Neon Nights' },
    artist: {
      isHidden: false,
      user: { status: 'ACTIVE', displayName: 'Synth Master', username: 'synth' }
    }
  };

  let mockDevices = [];
  const sid = 'session-test-456';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'desktop-connect-test-jwt-secret-at-least-32-chars';
    process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'desktop-connect-test-cookie-secret-at-least-32-chars';

    const token = jwt.sign({ userId: mockUser.id, sid }, process.env.JWT_SECRET, { expiresIn: '1h' });
    authCookie = `token=${token}`;

    const mockPrisma = {
      session: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.id === sid) {
            return {
              id: sid,
              userId: mockUser.id,
              token: hashToken(token),
              expiresAt: new Date(Date.now() + 60 * 60 * 1000)
            };
          }
          return null;
        })
      },
      user: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.id === mockUser.id) return { ...mockUser };
          return null;
        }),
        update: vi.fn(async ({ where, data }) => {
          Object.assign(mockUser, data);
          return { ...mockUser };
        })
      },
      desktopConnectionDevice: {
        create: vi.fn(async ({ data }) => {
          const device = { id: 'device-test-abc', createdAt: new Date(), ...data };
          mockDevices.push(device);
          return device;
        }),
        findFirst: vi.fn(async ({ where }) => {
          return mockDevices.find((d) => d.id === where.id && d.revokedAt === null) || null;
        }),
        findUnique: vi.fn(async ({ where }) => {
          return mockDevices.find((d) => d.id === where.id) || null;
        }),
        findMany: vi.fn(async ({ where }) => {
          return mockDevices.filter((d) => d.userId === where.userId && d.revokedAt === null);
        }),
        update: vi.fn(async ({ where, data }) => {
          const device = mockDevices.find((d) => d.id === where.id);
          if (device) Object.assign(device, data);
          return device;
        })
      },
      track: {
        findFirst: vi.fn(async ({ where }) => {
          if (where.id === mockTrack.id && where.status === 'PUBLISHED') {
            return mockTrack;
          }
          return null;
        })
      }
    };

    presenceManager = new RedisPresenceManager({ isTest: true });
    const storage = { getObjectMetadata: vi.fn(), checkHealth: vi.fn() };
    const audioQueue = { on: vi.fn(), close: vi.fn() };

    app = buildServer({
      prisma: mockPrisma,
      storage,
      audioQueue,
      rateLimitRedis: null,
      presenceManager
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await presenceManager.close();
  });

  it('starts device pairing flow and returns deviceCode + userCode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/device/start',
      payload: {
        deviceName: 'MacBook Pro M3',
        platform: 'macOS',
        appVersion: '0.1.0'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deviceCode).toHaveLength(64);
    expect(body.userCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    expect(body.verificationUriComplete).toContain(body.userCode);
    expect(body.expiresIn).toBe(600);
  });

  it('verifies userCode and authorizes device', async () => {
    // 1. Start pairing
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/device/start',
      payload: { deviceName: 'MacBook Air', platform: 'macOS', appVersion: '0.1.0' }
    });
    const { deviceCode, userCode } = startRes.json();

    // 2. Poll before authorization -> authorization_pending
    const pendingPoll = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/device/token',
      payload: { deviceCode }
    });
    expect(pendingPoll.statusCode).toBe(400);
    expect(pendingPoll.json().error).toBe('authorization_pending');

    // 3. User checks verify info
    const infoRes = await app.inject({
      method: 'GET',
      url: `/api/desktop-connect/device/verify-info?code=${userCode}`,
      headers: { cookie: authCookie }
    });
    expect(infoRes.statusCode).toBe(200);
    expect(infoRes.json().deviceName).toBe('MacBook Air');

    // 4. User authorizes device
    const authRes = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/device/authorize',
      headers: { cookie: authCookie },
      payload: { userCode, enableDiscordPresence: true }
    });
    expect(authRes.statusCode).toBe(200);
    expect(authRes.json().status).toBe('success');

    // 5. Desktop polls again -> gets tokens
    const tokenRes = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/device/token',
      payload: { deviceCode }
    });
    expect(tokenRes.statusCode).toBe(200);
    const tokenBody = tokenRes.json();
    expect(tokenBody.accessToken).toBeDefined();
    expect(tokenBody.refreshToken).toBeDefined();
    expect(tokenBody.deviceId).toBeDefined();
    expect(tokenBody.settings.enabled).toBe(true);

    // 6. Code consumed: second poll fails (one-time use)
    const secondPoll = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/device/token',
      payload: { deviceCode }
    });
    expect(secondPoll.statusCode).toBe(400);
    expect(secondPoll.json().error).toBe('invalid_grant');
  });

  it('rotates refresh token and issues new access token', async () => {
    // Create device in mock
    const initialRefresh = generateRefreshToken();
    const device = {
      id: 'device-rot-1',
      userId: mockUser.id,
      deviceName: 'iMac',
      platform: 'macOS',
      appVersion: '0.1.0',
      refreshTokenHash: hashRefreshToken(initialRefresh),
      rotationCounter: 0,
      revokedAt: null,
      user: mockUser
    };
    mockDevices.push(device);

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/device/refresh',
      payload: { deviceId: device.id, refreshToken: initialRefresh }
    });

    expect(refreshRes.statusCode).toBe(200);
    const body = refreshRes.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.refreshToken).not.toBe(initialRefresh);

    // Old refresh token is rejected
    const oldRefreshRes = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/device/refresh',
      payload: { deviceId: device.id, refreshToken: initialRefresh }
    });
    expect(oldRefreshRes.statusCode).toBe(401);
  });

  it('relays web player presence events and publishes to channel', async () => {
    let capturedEvent = null;
    const unsub = await presenceManager.subscribe(`channel:desktop-presence:${mockUser.id}`, (msg) => {
      capturedEvent = typeof msg === 'string' ? JSON.parse(msg) : msg;
    });

    const playRes = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/presence/event',
      headers: { cookie: authCookie },
      payload: {
        version: 1,
        event: 'play',
        trackId: mockTrack.id,
        positionMs: 12000,
        clientSequence: 10
      }
    });

    expect(playRes.statusCode).toBe(200);
    expect(playRes.json().acknowledged).toBe(true);

    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.type).toBe('presence.update');
    expect(capturedEvent.track.id).toBe(mockTrack.id);
    expect(capturedEvent.track.title).toBe('Neon Skyline');
    expect(capturedEvent.track.positionMs).toBe(12000);

    // Test pause event
    const pauseRes = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/presence/event',
      headers: { cookie: authCookie },
      payload: {
        version: 1,
        event: 'pause',
        trackId: mockTrack.id,
        positionMs: 14000,
        clientSequence: 11
      }
    });
    expect(pauseRes.statusCode).toBe(200);
    expect(capturedEvent.type).toBe('presence.pause');

    // Test ended event
    const endRes = await app.inject({
      method: 'POST',
      url: '/api/desktop-connect/presence/event',
      headers: { cookie: authCookie },
      payload: {
        version: 1,
        event: 'ended',
        clientSequence: 12
      }
    });
    expect(endRes.statusCode).toBe(200);
    expect(capturedEvent.type).toBe('presence.clear');

    await unsub();
  });

  it('manages settings and lists/revokes devices', async () => {
    // Get settings
    const getSettings = await app.inject({
      method: 'GET',
      url: '/api/desktop-connect/settings',
      headers: { cookie: authCookie }
    });
    expect(getSettings.statusCode).toBe(200);
    expect(getSettings.json().enabled).toBe(true);

    // Patch settings
    const patchSettings = await app.inject({
      method: 'PATCH',
      url: '/api/desktop-connect/settings',
      headers: { cookie: authCookie },
      payload: { showCover: false }
    });
    expect(patchSettings.statusCode).toBe(200);
    expect(patchSettings.json().showCover).toBe(false);

    // List devices
    const listDevices = await app.inject({
      method: 'GET',
      url: '/api/desktop-connect/devices',
      headers: { cookie: authCookie }
    });
    expect(listDevices.statusCode).toBe(200);
    expect(Array.isArray(listDevices.json().devices)).toBe(true);

    // Delete/Revoke device
    const deleteDevice = await app.inject({
      method: 'DELETE',
      url: `/api/desktop-connect/devices/${mockDevices[0].id}`,
      headers: { cookie: authCookie }
    });
    expect(deleteDevice.statusCode).toBe(200);
    expect(deleteDevice.json().status).toBe('success');
  });
});
