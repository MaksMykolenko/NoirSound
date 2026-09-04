import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadTrack } from '../real/uploads';

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

function storageResponse() {
  return { ok: true, status: 200 };
}

function trackData(overrides = {}) {
  return {
    title: 'Night Signal',
    description: 'Original release',
    genre: 'hip_hop',
    tags: ['underground'],
    copyrightConfirmed: true,
    lyricsText: 'Original lyric',
    lyricsType: 'PLAIN',
    lyricsLanguage: 'en',
    lyricsRightsConfirmed: true,
    audioFile: new File(['audio'], 'signal.wav', { type: 'audio/wav' }),
    coverFile: null,
    ...overrides,
  };
}

async function uploadAndReadInitBody(data) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(jsonResponse({
      uploadId: 'upload-1',
      trackId: 'track-1',
      audioUploadUrl: 'https://storage.test/audio',
      coverUploadUrl: null,
    }))
    .mockResolvedValueOnce(storageResponse())
    .mockResolvedValueOnce(jsonResponse({ success: true }));
  vi.stubGlobal('fetch', fetchMock);

  await uploadTrack(data);

  expect(fetchMock).toHaveBeenCalledTimes(3);
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe('single-upload Music / Beat API payload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends optional Beat metadata without converting a blank BPM to zero', async () => {
    const body = await uploadAndReadInitBody(trackData({
      contentType: 'BEAT',
      beatBpm: '',
      beatKey: ' F# Minor ',
      beatMood: ' Dark ',
      beatStyle: ' Trap ',
      beatLicenseType: ' Contact ',
      beatUsageNotes: ' Demo use ',
      beatContactEnabled: true,
    }));

    expect(body).toMatchObject({
      contentType: 'BEAT',
      beatBpm: null,
      beatKey: 'F# Minor',
      beatMood: 'Dark',
      beatStyle: 'Trap',
      beatLicenseType: 'Contact',
      beatUsageNotes: 'Demo use',
      beatContactEnabled: true,
      copyrightConfirmed: true,
      lyricsText: 'Original lyric',
      lyricsType: 'PLAIN',
      lyricsLanguage: 'en',
      lyricsRightsConfirmed: true,
    });
  });

  it('defaults old uploads to Music and clears stale Beat-only fields', async () => {
    const body = await uploadAndReadInitBody(trackData({
      beatBpm: 140,
      beatKey: 'C Minor',
      beatMood: 'Dark',
      beatStyle: 'Trap',
      beatLicenseType: 'Contact',
      beatUsageNotes: 'Demo use',
      beatContactEnabled: true,
    }));

    expect(body).toMatchObject({
      contentType: 'MUSIC',
      beatBpm: null,
      beatKey: null,
      beatMood: null,
      beatStyle: null,
      beatLicenseType: null,
      beatUsageNotes: null,
      beatContactEnabled: false,
      copyrightConfirmed: true,
      lyricsText: 'Original lyric',
      lyricsRightsConfirmed: true,
    });
  });

  it('preserves a valid synced-lyrics payload instead of downgrading it to plain text', async () => {
    const lyricsSynced = [
      { time: 0, text: 'First timed line' },
      { time: 12.5, text: 'Second timed line' },
    ];
    const body = await uploadAndReadInitBody(trackData({
      lyricsText: '',
      lyricsType: 'SYNCED',
      lyricsSynced,
      lyricsLanguage: 'uk',
      lyricsRightsConfirmed: true,
    }));

    expect(body).toMatchObject({
      lyricsText: '',
      lyricsType: 'SYNCED',
      lyricsSynced,
      lyricsLanguage: 'uk',
      lyricsRightsConfirmed: true,
    });
  });
});
