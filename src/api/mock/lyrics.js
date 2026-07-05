import { mockTracks } from './data';

const lyricsByTrackId = new Map([
  ['1', {
    trackId: '1',
    hasLyrics: true,
    lyricsType: 'PLAIN',
    lyricsLanguage: 'en',
    lyricsText: 'City lights dissolve in rain\nMidnight carries us again',
    lyricsUpdatedAt: '2026-07-05T00:00:00.000Z',
  }],
]);

function emptyLyrics(trackId) {
  return { trackId, hasLyrics: false };
}

export async function getTrackLyrics(trackId) {
  return lyricsByTrackId.get(String(trackId)) || emptyLyrics(String(trackId));
}

export async function getManageTrackLyrics(trackId) {
  return getTrackLyrics(trackId);
}

export async function updateTrackLyrics(trackId, payload) {
  const id = String(trackId);
  const text = String(payload.lyricsText || '').replace(/\r\n?/g, '\n').trim();
  const track = mockTracks.find((entry) => entry.id === id);
  if (!track) throw new Error('Track not found');
  if (!text) {
    lyricsByTrackId.delete(id);
    track.hasLyrics = false;
    track.lyricsType = 'NONE';
    return { id, hasLyrics: false, lyricsType: 'NONE', lyricsLanguage: null };
  }
  const next = {
    trackId: id,
    hasLyrics: true,
    lyricsType: payload.lyricsType || 'PLAIN',
    lyricsLanguage: payload.lyricsLanguage || null,
    lyricsText: text,
    lyricsUpdatedAt: new Date().toISOString(),
  };
  lyricsByTrackId.set(id, next);
  track.hasLyrics = true;
  track.lyricsType = next.lyricsType;
  return {
    id,
    hasLyrics: true,
    lyricsType: next.lyricsType,
    lyricsLanguage: next.lyricsLanguage,
    lyricsUpdatedAt: next.lyricsUpdatedAt,
  };
}
