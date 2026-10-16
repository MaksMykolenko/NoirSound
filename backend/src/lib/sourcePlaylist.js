'use strict';

const { CatalogError } = require('./externalCatalog');
const { playlistLink } = require('./playlistImport');
const providers = new Set(['SPOTIFY', 'YOUTUBE', 'SOUNDCLOUD']);
const canResolveSource = item => Boolean(item.artist && item.title && item.title !== 'Unavailable track');

function sourcePlayback(provider, id) {
  if (provider === 'SPOTIFY' && /^[A-Za-z0-9]{22}$/.test(id || '')) {
    return { canonicalUrl: `https://open.spotify.com/track/${id}`, embedUrl: `https://open.spotify.com/embed/track/${id}` };
  }
  if (provider === 'YOUTUBE' && /^[A-Za-z0-9_-]{11}$/.test(id || '')) {
    return { canonicalUrl: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (provider === 'SOUNDCLOUD' && /^\d{1,20}$/.test(id || '')) {
    const canonicalUrl = `https://api.soundcloud.com/tracks/${id}`;
    return { canonicalUrl, embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonicalUrl)}` };
  }
  return null;
}

function sourceItem(provider, entry) {
  if (!providers.has(provider)) throw new CatalogError('IMPORT_INPUT_INVALID', 400);
  const playback = sourcePlayback(provider, entry.sourceId);
  return {
    title: String(entry.title || 'Unavailable track').slice(0, 300),
    artist: String(entry.artist || '').slice(0, 200),
    duration: Number(entry.duration) > 0 ? Math.min(Number(entry.duration), 36000) : null,
    sourceId: playback ? entry.sourceId : null,
    unavailable: !playback || Boolean(entry.unavailable),
  };
}

function sourcePlaylistView(playlist, includeItems = false) {
  const source = playlist.sourceImport;
  if (!source || source.version !== 1 || !providers.has(source.provider) || !Array.isArray(source.items)) return null;
  return {
    provider: source.provider,
    sourceUrl: source.sourceUrl,
    total: source.items.length,
    unavailable: source.items.filter(item => item.unavailable).length,
    ...(includeItems ? { items: source.items.map((entry, position) => {
      const playback = sourcePlayback(source.provider, entry.sourceId);
      return {
        ...sourceItem(source.provider,entry), position, id: `source:${playlist.id}:${position}`,
        provider: source.provider, artistName: entry.artist,
        sourceUnavailable: Boolean(entry.unavailable), unavailable: Boolean(entry.unavailable),
        canResolve: Boolean(playback && !entry.unavailable),
        playbackProvider: source.provider,
        importedPlaylistId: playlist.id,
        canonicalUrl: playback?.canonicalUrl || null,
        playbackMode: playback && !entry.unavailable ? 'IMPORTED_SOURCE' : 'UNAVAILABLE',
        isStreamable: false, hasLyrics: false,
      };
    }) } : {}),
  };
}

function sourcePlaylistPlayback(source) {
  const parsed = playlistLink(source.sourceUrl);
  if (parsed.provider !== source.provider) return null;
  const canonicalUrl = source.sourceUrl;
  if (parsed.provider === 'SPOTIFY') return { canonicalUrl, embedUrl: `https://open.spotify.com/embed/playlist/${parsed.id}` };
  if (parsed.provider === 'YOUTUBE') return { canonicalUrl, embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${parsed.id}` };
  return { canonicalUrl, embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonicalUrl)}` };
}

module.exports = { sourcePlayback, sourceItem, sourcePlaylistView, sourcePlaylistPlayback, canResolveSource };
