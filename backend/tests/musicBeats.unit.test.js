import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TRACK_CONTENT_TYPE_INVALID,
  parseTrackContentType,
} from '../src/lib/trackContentType';
import {
  BEAT_BPM_INVALID,
  BEAT_METADATA_INVALID,
  EMPTY_BEAT_METADATA,
  publicBeatMetadata,
  validateBeatMetadata,
} from '../src/lib/beatMetadata';
import { serializePublicTrack } from '../src/lib/publicTrack';
import { serializeBatch } from '../src/lib/batchUpload';
import uploadBatchesRoutes, { trackDataFromItem } from '../src/routes/uploadBatches';
import statsRoutes from '../src/routes/stats';
import tracksRoutes from '../src/routes/tracks';
import uploadsRoutes from '../src/routes/uploads';
import adminRoutes from '../src/routes/admin';

function track(overrides = {}) {
  return {
    id: 'track-1',
    title: 'Night Signal',
    status: 'PUBLISHED',
    isPublic: true,
    lyricsType: 'NONE',
    lyricsRightsConfirmed: false,
    processedAudioKey: 'processed/private.mp3',
    coverImageKey: 'uploads/private.png',
    ...overrides,
  };
}

function batchItem(overrides = {}) {
  return {
    id: 'item-1',
    clientId: 'client-1',
    fileName: 'beat.wav',
    fileSize: 2048,
    mimeType: 'audio/wav',
    status: 'READY',
    target: 'SINGLE',
    playlistOrder: null,
    title: 'Night Signal',
    primaryArtistName: 'Producer',
    featuredArtists: [],
    genre: 'hip_hop',
    tags: ['dark'],
    description: '',
    explicit: false,
    isPublic: true,
    copyrightConfirmed: true,
    lyricsText: null,
    lyricsType: 'NONE',
    lyricsLanguage: null,
    lyricsSynced: null,
    lyricsRightsConfirmed: false,
    upload: {
      id: 'upload-1',
      status: 'READY',
      storageKey: 'uploads/private/beat.wav',
      coverStorageKey: 'uploads/private/cover.png',
    },
    track: null,
    createdAt: new Date('2026-08-27T12:00:00.000Z'),
    updatedAt: new Date('2026-08-27T12:00:00.000Z'),
    ...overrides,
  };
}

describe('track content type parsing', () => {
  it('keeps legacy payloads compatible by defaulting to Music', () => {
    expect(parseTrackContentType(undefined)).toEqual({ ok: true, value: 'MUSIC' });
    expect(parseTrackContentType(null)).toEqual({ ok: true, value: 'MUSIC' });
    expect(parseTrackContentType(undefined, { defaultValue: null }))
      .toEqual({ ok: true, value: null });
  });

  it('normalizes the two supported values and rejects every other shape', () => {
    expect(parseTrackContentType(' music ')).toEqual({ ok: true, value: 'MUSIC' });
    expect(parseTrackContentType('beat')).toEqual({ ok: true, value: 'BEAT' });

    for (const value of ['', 'podcast', 1, ['BEAT'], {}]) {
      expect(parseTrackContentType(value)).toMatchObject({
        ok: false,
        error: TRACK_CONTENT_TYPE_INVALID,
      });
    }
  });
});

describe('Beat metadata validation and serialization', () => {
  it('normalizes safe Beat metadata and accepts inclusive BPM boundaries', () => {
    const result = validateBeatMetadata({
      beatKey: ' f♯ min ',
      beatBpm: 40,
      beatMood: '  nocturnal  ',
      beatStyle: ' Trap ',
      beatLicenseType: ' Non-exclusive ',
      beatUsageNotes: 'Credit the producer.\nContact before sync use.',
      beatContactEnabled: true,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        beatKey: 'F# Minor',
        beatBpm: 40,
        beatMood: 'nocturnal',
        beatStyle: 'Trap',
        beatLicenseType: 'Non-exclusive',
        beatUsageNotes: 'Credit the producer.\nContact before sync use.',
        beatContactEnabled: true,
      },
    });
    expect(validateBeatMetadata({ beatBpm: 240 }).ok).toBe(true);
  });

  it('returns stable errors for invalid BPM, markup, key, and contact values', () => {
    for (const beatBpm of [39, 241, 100.5, '120', Number.NaN]) {
      expect(validateBeatMetadata({ beatBpm })).toMatchObject({
        ok: false,
        error: BEAT_BPM_INVALID,
        field: 'beatBpm',
      });
    }

    expect(validateBeatMetadata({ beatMood: '<img src=x>' })).toMatchObject({
      ok: false,
      error: BEAT_METADATA_INVALID,
      field: 'beatMood',
    });
    expect(validateBeatMetadata({ beatKey: 'H# Major' })).toMatchObject({
      ok: false,
      error: BEAT_METADATA_INVALID,
      field: 'beatKey',
    });
    expect(validateBeatMetadata({ beatContactEnabled: 'true' })).toMatchObject({
      ok: false,
      error: BEAT_METADATA_INVALID,
      field: 'beatContactEnabled',
    });
  });

  it('clears every Beat-only field whenever the item becomes Music', () => {
    const result = validateBeatMetadata({
      beatKey: 'C Minor',
      beatBpm: 120,
      beatMood: '<stale markup>',
      beatStyle: 'Trap',
      beatLicenseType: 'Lease',
      beatUsageNotes: 'Old terms',
      beatContactEnabled: true,
    }, { contentType: 'MUSIC' });

    expect(result).toEqual({ ok: true, data: { ...EMPTY_BEAT_METADATA } });
    expect(publicBeatMetadata({
      contentType: 'MUSIC',
      beatBpm: 120,
      beatMood: 'stale',
      beatContactEnabled: true,
    })).toEqual({ contentType: 'MUSIC' });
  });

  it('serializes only safe public fields for Beats and defaults legacy tracks to Music', () => {
    const beat = serializePublicTrack(track({
      contentType: 'BEAT',
      beatKey: 'D Minor',
      beatBpm: 142,
      beatMood: 'Dark',
      beatStyle: 'Drill',
      beatLicenseType: 'Lease',
      beatUsageNotes: 'Contact for stems.',
      beatContactEnabled: true,
      originalAudioKey: 'uploads/private-original.wav',
    }));

    expect(beat).toMatchObject({
      contentType: 'BEAT',
      beatKey: 'D Minor',
      beatBpm: 142,
      beatMood: 'Dark',
      beatStyle: 'Drill',
      beatLicenseType: 'Lease',
      beatUsageNotes: 'Contact for stems.',
      beatContactEnabled: true,
      hasCoverImage: true,
      isStreamable: true,
    });
    expect(beat).not.toHaveProperty('originalAudioKey');
    expect(beat).not.toHaveProperty('processedAudioKey');
    expect(beat).not.toHaveProperty('coverImageKey');

    const legacyMusic = serializePublicTrack(track({
      contentType: undefined,
      beatBpm: 120,
      beatUsageNotes: 'must not leak',
    }));
    expect(legacyMusic.contentType).toBe('MUSIC');
    expect(legacyMusic).not.toHaveProperty('beatBpm');
    expect(legacyMusic).not.toHaveProperty('beatUsageNotes');
  });
});

describe('batch Beat persistence and public serialization', () => {
  it('copies validated Beat metadata into the draft Track persistence shape', () => {
    const item = batchItem({
      contentType: 'BEAT',
      beatKey: 'Bb Major',
      beatBpm: 96,
      beatMood: 'Soulful',
      beatStyle: 'Boom bap',
      beatLicenseType: 'Exclusive',
      beatUsageNotes: 'Publishing split negotiable.',
      beatContactEnabled: true,
    });

    expect(trackDataFromItem(item, { artistProfileId: 'artist-1' })).toMatchObject({
      artistId: 'artist-1',
      contentType: 'BEAT',
      beatKey: 'Bb Major',
      beatBpm: 96,
      beatMood: 'Soulful',
      beatStyle: 'Boom bap',
      beatLicenseType: 'Exclusive',
      beatUsageNotes: 'Publishing split negotiable.',
      beatContactEnabled: true,
      status: 'DRAFT',
    });
  });

  it('returns Beat metadata from the batch API without exposing storage keys', () => {
    const payload = serializeBatch({
      id: 'batch-1',
      mode: 'MIXED',
      status: 'READY',
      artistProfileId: 'artist-1',
      playlistTitle: '',
      playlistDescription: '',
      playlistIsPublic: true,
      playlistTags: [],
      items: [batchItem({
        contentType: 'BEAT',
        beatKey: 'A Minor',
        beatBpm: 128,
        beatMood: 'Energetic',
        beatContactEnabled: true,
      })],
      createdAt: new Date('2026-08-27T12:00:00.000Z'),
      updatedAt: new Date('2026-08-27T12:00:00.000Z'),
    });

    expect(payload.items[0]).toMatchObject({
      contentType: 'BEAT',
      beatKey: 'A Minor',
      beatBpm: 128,
      beatMood: 'Energetic',
      beatContactEnabled: true,
    });
    expect(JSON.stringify(payload)).not.toContain('uploads/private');
  });

  it('does not serialize stale Beat fields for Music batch items', () => {
    const payload = serializeBatch({
      id: 'batch-1',
      mode: 'MIXED',
      status: 'READY',
      artistProfileId: 'artist-1',
      playlistTitle: '',
      playlistDescription: '',
      playlistIsPublic: true,
      playlistTags: [],
      items: [batchItem({
        contentType: 'MUSIC',
        beatBpm: 128,
        beatUsageNotes: 'must not leak',
      })],
    });

    expect(payload.items[0].contentType).toBe('MUSIC');
    expect(payload.items[0]).not.toHaveProperty('beatBpm');
    expect(payload.items[0]).not.toHaveProperty('beatUsageNotes');
  });
});

describe('liked-track content filter route', () => {
  let app;

  afterEach(async () => {
    if (app) await app.close();
    app = null;
  });

  async function buildLikedTracksApp() {
    const findMany = vi.fn(async ({ where }) => [{
      createdAt: new Date('2026-08-27T12:00:00.000Z'),
      track: track({
        contentType: where.track.contentType || 'MUSIC',
        beatBpm: where.track.contentType === 'BEAT' ? 120 : null,
      }),
    }]);
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request) => {
      request.user = { id: 'listener-1', role: 'LISTENER', status: 'ACTIVE' };
    });
    app.decorate('prisma', { trackLike: { findMany } });
    await app.register(statsRoutes, { prefix: '/api' });
    await app.ready();
    return { findMany };
  }

  it('applies a validated Beat filter inside the owner-scoped like query', async () => {
    const { findMany } = await buildLikedTracksApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/me/liked-tracks?contentType=beat',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data[0]).toMatchObject({ contentType: 'BEAT', beatBpm: 120 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'listener-1',
        track: expect.objectContaining({ contentType: 'BEAT' }),
      }),
    }));
  });

  it('keeps an unfiltered legacy request and rejects unsupported filters before querying', async () => {
    const { findMany } = await buildLikedTracksApp();
    const legacy = await app.inject({ method: 'GET', url: '/api/me/liked-tracks' });
    expect(legacy.statusCode).toBe(200);
    expect(findMany.mock.calls[0][0].where.track).not.toHaveProperty('contentType');

    findMany.mockClear();
    const invalid = await app.inject({
      method: 'GET',
      url: '/api/me/liked-tracks?contentType=podcast',
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: TRACK_CONTENT_TYPE_INVALID });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('public Music / Beats track routes', () => {
  let app;

  afterEach(async () => {
    if (app) await app.close();
    app = null;
  });

  async function buildTracksApp() {
    const findMany = vi.fn(async ({ where }) => [track({
      contentType: where.contentType || 'MUSIC',
      beatBpm: where.contentType === 'BEAT' ? 132 : null,
      beatKey: where.contentType === 'BEAT' ? 'C Minor' : null,
    })]);
    const findFirst = vi.fn(async ({ where }) => (
      where.id === 'hidden-beat'
        ? null
        : track({ contentType: 'BEAT', beatBpm: 132, beatKey: 'C Minor' })
    ));
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request) => {
      request.user = { id: 'listener-1', role: 'LISTENER', status: 'ACTIVE' };
    });
    app.decorate('prisma', { track: { findMany, findFirst } });
    await app.register(tracksRoutes, { prefix: '/api/tracks' });
    await app.ready();
    return { findMany, findFirst };
  }

  it.each(['MUSIC', 'BEAT'])('applies the %s filter without relaxing public visibility', async (contentType) => {
    const { findMany } = await buildTracksApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/tracks?contentType=${contentType.toLowerCase()}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data[0].contentType).toBe(contentType);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: 'PUBLISHED',
        isPublic: true,
        contentType,
        artist: { isHidden: false, user: { status: 'ACTIVE' } },
      },
    }));
  });

  it('combines content type and server-side catalogue search before applying the feed limit', async () => {
    const { findMany } = await buildTracksApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks?contentType=BEAT&q=night%20signal',
    });

    expect(response.statusCode).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        contentType: 'BEAT',
        OR: expect.arrayContaining([
          { title: { contains: 'night signal', mode: 'insensitive' } },
          { beatMood: { contains: 'night signal', mode: 'insensitive' } },
        ]),
      }),
      take: 20,
    }));
  });

  it('returns Beat detail metadata and keeps a non-public/hidden result unavailable', async () => {
    const { findFirst } = await buildTracksApp();
    const detail = await app.inject({ method: 'GET', url: '/api/tracks/track-1' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().track).toMatchObject({
      contentType: 'BEAT',
      beatBpm: 132,
      beatKey: 'C Minor',
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'PUBLISHED',
        artist: { isHidden: false, user: { status: 'ACTIVE' } },
      }),
    }));

    const hidden = await app.inject({ method: 'GET', url: '/api/tracks/hidden-beat' });
    expect(hidden.statusCode).toBe(404);
  });

  it('rejects an unsupported content type before querying the catalogue', async () => {
    const { findMany } = await buildTracksApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks?contentType=podcast',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: TRACK_CONTENT_TYPE_INVALID });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('single upload Music / Beats persistence', () => {
  let app;

  afterEach(async () => {
    if (app) await app.close();
    app = null;
  });

  async function buildUploadsApp() {
    const trackCreate = vi.fn(async ({ data }) => ({ id: 'track-uploaded', ...data }));
    const uploadCreate = vi.fn(async ({ data }) => ({ id: 'upload-1', ...data }));
    const tx = {
      track: { create: trackCreate },
      upload: { create: uploadCreate },
    };
    const prisma = {
      artistProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'artist-1', isHidden: false }),
      },
      upload: { update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (operation) => operation(tx)),
    };
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request) => {
      request.user = { id: 'artist-user-1', role: 'ARTIST', status: 'ACTIVE' };
    });
    app.decorate('prisma', prisma);
    app.decorate('storage', {
      createPresignedPutUrl: vi.fn(async (key) => `https://storage.test/${encodeURIComponent(key)}`),
    });
    await app.register(uploadsRoutes, { prefix: '/api/uploads' });
    await app.ready();
    return { trackCreate };
  }

  const uploadBody = (overrides = {}) => ({
    title: 'Upload Contract',
    description: '',
    genre: 'electronic',
    tags: ['e2e'],
    copyrightConfirmed: true,
    audio: {
      filename: 'contract.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2048,
    },
    ...overrides,
  });

  it('keeps a legacy upload Music by default and clears stale Beat fields', async () => {
    const { trackCreate } = await buildUploadsApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/uploads/track/init',
      payload: uploadBody({ beatBpm: 140, beatUsageNotes: 'stale' }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().contentType).toBe('MUSIC');
    expect(trackCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentType: 'MUSIC',
        ...EMPTY_BEAT_METADATA,
      }),
    });
  });

  it('normalizes and persists optional Beat metadata during upload initialization', async () => {
    const { trackCreate } = await buildUploadsApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/uploads/track/init',
      payload: uploadBody({
        contentType: 'beat',
        beatBpm: 144,
        beatKey: 'f# min',
        beatMood: '  Dark  ',
        beatStyle: 'Trap',
        beatLicenseType: 'Contact',
        beatUsageNotes: 'Credit required.',
        beatContactEnabled: true,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().contentType).toBe('BEAT');
    expect(trackCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentType: 'BEAT',
        beatBpm: 144,
        beatKey: 'F# Minor',
        beatMood: 'Dark',
        beatStyle: 'Trap',
        beatLicenseType: 'Contact',
        beatUsageNotes: 'Credit required.',
        beatContactEnabled: true,
      }),
    });
  });

  it('returns the stable BPM error before creating a Track', async () => {
    const { trackCreate } = await buildUploadsApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/uploads/track/init',
      payload: uploadBody({ contentType: 'BEAT', beatBpm: 300 }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: BEAT_BPM_INVALID, field: 'beatBpm' });
    expect(trackCreate).not.toHaveBeenCalled();
  });
});

describe('artist dashboard Music / Beats aggregation', () => {
  let app;

  afterEach(async () => {
    if (app) await app.close();
    app = null;
  });

  it('keeps total stats intact while splitting release counts, plays, and top lists', async () => {
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request) => {
      request.user = { id: 'artist-user-1', role: 'ARTIST', status: 'ACTIVE' };
    });
    app.decorate('prisma', {
      artistProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'artist-1',
          monthlyListeners: 9,
          isHidden: false,
          _count: { followers: 4 },
        }),
      },
      track: {
        findMany: vi.fn().mockResolvedValue([
          track({ id: 'music-1', contentType: 'MUSIC', plays: 12, likes: 2, createdAt: new Date(), updatedAt: new Date() }),
          track({ id: 'beat-1', contentType: 'BEAT', plays: 30, likes: 3, beatBpm: 138, createdAt: new Date(), updatedAt: new Date() }),
          track({ id: 'draft-beat', contentType: 'BEAT', status: 'DRAFT', plays: 99, likes: 0, createdAt: new Date(), updatedAt: new Date() }),
        ]),
      },
    });
    await app.register(statsRoutes, { prefix: '/api' });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/me/artist-dashboard' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totalPlays: 42,
      totalLikes: 5,
      publishedTrackCount: 2,
      musicTrackCount: 1,
      beatTrackCount: 1,
      musicPlays: 12,
      beatPlays: 30,
      topMusicTracks: [{ id: 'music-1', contentType: 'MUSIC' }],
      topBeats: [{ id: 'beat-1', contentType: 'BEAT', beatBpm: 138 }],
    });
  });
});

describe('admin Music / Beats moderation contract', () => {
  let app;

  afterEach(async () => {
    if (app) await app.close();
    app = null;
  });

  async function buildAdminApp() {
    const storedTrack = track({
      contentType: 'BEAT',
      beatBpm: 120,
      beatKey: 'A Minor',
      beatUsageNotes: 'Old terms',
      beatContactEnabled: true,
      artist: { user: { displayName: 'Producer' } },
      _count: { comments: 0 },
      uploads: [],
      updatedAt: new Date(),
    });
    const trackFindMany = vi.fn().mockResolvedValue([storedTrack]);
    const trackUpdate = vi.fn(async ({ data }) => ({ ...storedTrack, ...data }));
    const auditCreate = vi.fn(async ({ data }) => ({ id: 'audit-1', ...data }));
    const tx = { track: { update: trackUpdate }, auditLog: { create: auditCreate } };
    const prisma = {
      track: {
        count: vi.fn().mockResolvedValue(1),
        findMany: trackFindMany,
        findUnique: vi.fn().mockResolvedValue(storedTrack),
      },
      report: { groupBy: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (operation) => (
        Array.isArray(operation) ? Promise.all(operation) : operation(tx)
      )),
    };
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request) => {
      request.user = { id: 'admin-1', role: 'ADMIN', status: 'ACTIVE' };
    });
    app.decorate('requireAdmin', async () => {});
    app.decorate('prisma', prisma);
    await app.register(adminRoutes, { prefix: '/api/admin' });
    await app.ready();
    return { trackFindMany, trackUpdate, auditCreate };
  }

  it('filters the admin track list by validated content type', async () => {
    const { trackFindMany } = await buildAdminApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/tracks?contentType=BEAT',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data[0].contentType).toBe('BEAT');
    expect(trackFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { contentType: 'BEAT' },
    }));
  });

  it('requires a reason, clears stale Beat metadata on Music, and writes an audit record', async () => {
    const { trackUpdate, auditCreate } = await buildAdminApp();
    const missingReason = await app.inject({
      method: 'POST',
      url: '/api/admin/tracks/track-1/content-type',
      payload: { contentType: 'MUSIC' },
    });
    expect(missingReason.statusCode).toBe(400);
    expect(missingReason.json().error).toBe('ADMIN_REASON_REQUIRED');

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/tracks/track-1/content-type',
      payload: { contentType: 'MUSIC', reason: 'Incorrectly categorized upload' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().track).toMatchObject({ contentType: 'MUSIC', ...EMPTY_BEAT_METADATA });
    expect(trackUpdate).toHaveBeenCalledWith({
      where: { id: 'track-1' },
      data: { contentType: 'MUSIC', ...EMPTY_BEAT_METADATA },
    });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'TRACK_CONTENT_TYPE_UPDATE',
        reason: 'Incorrectly categorized upload',
      }),
    }));
  });
});

// Importing the route above also proves its CommonJS named helper export stays
// available to the existing Vitest ESM suites.
expect(uploadBatchesRoutes).toBeTypeOf('function');
