const lyricsCache = new Map();

export function getCachedFullscreenLyrics(trackId) {
  return lyricsCache.get(String(trackId));
}

export function cacheFullscreenLyrics(trackId, lyrics) {
  lyricsCache.set(String(trackId), lyrics);
}

export function deleteCachedFullscreenLyrics(trackId) {
  lyricsCache.delete(String(trackId));
}

export function clearFullscreenLyricsCache() {
  lyricsCache.clear();
}
