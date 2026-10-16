'use strict';
const { parseLrc } = require('../lib/lrc');
const { serializeLyrics, validateSyncedLyrics } = require('../lib/lyrics');
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function createLyricsProvider({ fetchImpl = globalThis.fetch, env = process.env, now = Date.now } = {}) {
  const cache = new Map();
  return async function lookup(track) {
    const own = serializeLyrics(track);
    if (own.hasLyrics || env.LRCLIB_ENABLED === 'false') return own;
    const title = track.title;
    const artist = track.primaryArtistName || track.artistName || track.artist?.user?.displayName;
    const duration = Number(track.durationSeconds || track.duration);
    if (!title || !artist || !(duration > 0)) return own;
    const key = JSON.stringify([title, artist, duration]);
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return { ...cached.value, trackId: track.id };
    const url = new URL('https://lrclib.net/api/get');
    url.search = new URLSearchParams({ track_name: title, artist_name: artist, duration: String(Math.round(duration)) });
    const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'NoirSound/1.0 (https://noirsound.co)', Accept: 'application/json' } });
    let value = { hasLyrics: false };
    if (response.status !== 404) {
      if (!response.ok) { await response.body?.cancel(); throw new Error('LYRICS_PROVIDER_UNAVAILABLE'); }
      const reader = response.body.getReader();
      const chunks = []; let size = 0;
      try {
        for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 250000) throw new Error('LYRICS_RESPONSE_TOO_LARGE'); chunks.push(value); }
      } finally { await reader.cancel(); }
      const data = JSON.parse(Buffer.concat(chunks).toString());
      // Never display a similarly named recording's lyrics as a confirmed match.
      if (normalize(data.trackName) === normalize(title) && normalize(data.artistName) === normalize(artist) && Math.abs(Number(data.duration) - duration) <= 3) {
        const lines = parseLrc(data.syncedLyrics);
        const validLines = lines.length && validateSyncedLyrics(lines).ok;
        const plain = typeof data.plainLyrics === 'string' ? data.plainLyrics.slice(0, 50000) : '';
        if (validLines || plain) value = { hasLyrics: true, lyricsType: validLines ? 'SYNCED' : 'PLAIN', lyricsText: plain || lines.map(x => x.text).join('\n'), ...(validLines ? { lyricsSynced: lines } : {}), source: 'LRCLIB', sourceUrl: 'https://lrclib.net', lyricsLanguage: null };
        else if (data.instrumental) value = { hasLyrics: false, instrumental: true, source: 'LRCLIB' };
      }
    } else await response.body?.cancel();
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: now() + 15 * 60 * 1000 });
    return { ...value, trackId: track.id };
  };
}
const provider = createLyricsProvider();
const lookupLyrics = track => process.env.NODE_ENV === 'test' && process.env.LRCLIB_ENABLED !== 'true' ? Promise.resolve(serializeLyrics(track)) : provider(track);
module.exports = { createLyricsProvider, lookupLyrics };
