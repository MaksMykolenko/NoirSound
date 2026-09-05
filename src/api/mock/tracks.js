import { mockTracks } from './data';
import { getGroupOf, MUSIC_GENRES, normalizeGenre } from '../../constants/musicGenres';
import { normalizeTrackContentType } from '../../utils/trackContent';
import { getGenreLabel } from '../../utils/genreLabels';

const DEMO_LIKED_TRACK_IDS = new Set(['1', '2', '5']);

function matchesBpm(track, range) {
  if (!range) return true;
  const bpm = Number(track.beatBpm);
  if (!Number.isFinite(bpm)) return false;
  if (range === 'under-90') return bpm < 90;
  if (range === '90-119') return bpm >= 90 && bpm <= 119;
  if (range === '120-149') return bpm >= 120 && bpm <= 149;
  if (range === '150-plus') return bpm >= 150;
  return true;
}

function filterCatalogue(tracks, options = {}) {
  const requested = typeof options === 'string' ? options : options?.contentType;
  const normalized = requested ? normalizeTrackContentType(requested) : null;
  const query = typeof options === 'object' ? String(options.query || '').trim().toLowerCase() : '';
  const style = typeof options === 'object' ? String(options.style || '').trim().toLowerCase() : '';
  const mood = typeof options === 'object' ? String(options.mood || '').trim().toLowerCase() : '';
  const key = typeof options === 'object' ? String(options.key || '').trim().toLowerCase() : '';
  const genre = typeof options === 'object' ? String(options.genre || '').trim().toLowerCase() : '';
  const group = typeof options === 'object' ? String(options.group || '').trim() : '';
  const bpm = typeof options === 'object' ? options.bpm : '';

  const filtered = tracks.filter((track) => {
    if (normalized && normalizeTrackContentType(track.contentType) !== normalized) return false;
    if (style && !String(track.beatStyle || '').toLowerCase().includes(style)) return false;
    if (mood && !String(track.beatMood || '').toLowerCase().includes(mood)) return false;
    if (key && String(track.beatKey || '').trim().toLowerCase() !== key) return false;
    if (genre && !String(track.genre || '').toLowerCase().includes(genre)) return false;
    if (group && getGroupOf(track.genre) !== group) return false;
    if (!matchesBpm(track, bpm)) return false;
    if (!query) return true;
    return [
      track.title,
      track.artistName,
      track.genre,
      track.beatMood,
      track.beatStyle,
      track.beatKey,
      ...(track.tags || []),
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });

  const sorted = [...filtered].sort((left, right) => {
    if (options?.sort === 'played' || options?.sort === 'trending') {
      const playDifference = Number(right.plays || 0) - Number(left.plays || 0);
      if (playDifference !== 0) return playDifference;
    }
    return new Date(right.publishedAt || right.releaseDate || right.createdAt || 0)
      - new Date(left.publishedAt || left.releaseDate || left.createdAt || 0);
  });
  const limit = Math.max(1, Number(options?.limit || sorted.length));
  const page = Math.max(1, Number(options?.page || 1));
  return sorted.slice((page - 1) * limit, page * limit);
}

export async function getTracks(options = {}) {
  return filterCatalogue([...mockTracks], options);
}

export async function getTrackById(id) {
  const track = mockTracks.find((item) => item.id === id);
  if (!track) throw new Error('Track not found');
  return track;
}

export async function getTracksByArtist(artistId, options = {}) {
  return filterCatalogue(mockTracks.filter((track) => track.artistId === artistId), options);
}

export async function getDiscoverTracks(options = {}) {
  return filterCatalogue([...mockTracks], options);
}

export async function getTrendingTracks(options = {}) {
  return {
    tracks: filterCatalogue([...mockTracks], { ...options, sort: 'trending' }),
    meta: { sort: 'trending', windowDays: 7 },
  };
}

export async function searchTracks(query, options = {}, requestOptions = {}) {
  return (await getCatalogTracks({ ...options, q: query }, requestOptions)).items;
}

export async function setTrackLiked() {
  return { success: true };
}

export async function getLikedTracks(options = {}) {
  return filterCatalogue(
    mockTracks.filter((track) => DEMO_LIKED_TRACK_IDS.has(track.id)),
    options,
  );
}

// Explicit demo adapter for the server catalog contract. Real mode never uses
// this data or substitutes it for a failed request.
export async function getCatalogTracks(options = {}, { signal } = {}) {
  signal?.throwIfAborted();
  const query = String(options.q ?? options.query ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
  const searchGenres = new Set(query ? MUSIC_GENRES.filter((genre) => (
    [genre.key, genre.label, ...genre.aliases].some((value) => value.toLowerCase().includes(query))
  )).map((genre) => genre.key) : []);
  const type = options.contentType || 'ALL';
  const sort = options.sort || 'recent';
  const limit = Number(options.limit || 30);
  if (query.length > 120 || !['ALL', 'MUSIC', 'BEAT'].includes(type) || !['recent', 'played', 'liked', 'trending'].includes(sort) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid catalog query');
  if (options.genre && options.group) throw new Error('Genre and group cannot be combined');
  if (type !== 'BEAT' && ['style', 'mood', 'key', 'bpm', 'bpmMin', 'bpmMax'].some((key) => options[key] !== undefined && options[key] !== '')) throw new Error('Beat filters require Beats');
  const eligible = mockTracks.filter((track) => track.isPublic !== false && (!track.status || track.status === 'PUBLISHED'));
  const matches = (track, excluded = []) => {
    if (type !== 'ALL' && normalizeTrackContentType(track.contentType) !== type) return false;
    if (query && ![
      track.title,
      track.artistName,
      track.primaryArtistName,
      ...(track.featuredArtists || []),
      track.genre,
      getGenreLabel(track.genre),
      track.beatStyle,
      track.beatMood,
      ...(track.tags || []),
    ].some((value) => String(value || '').toLowerCase().includes(query)) && !searchGenres.has(normalizeGenre(track.genre))) return false;
    if (!excluded.includes('taxonomy')) {
      if (options.genre && normalizeGenre(track.genre) !== normalizeGenre(options.genre)) return false;
      if (options.group && getGroupOf(track.genre) !== options.group) return false;
    }
    for (const [key, field] of [['style', 'beatStyle'], ['mood', 'beatMood'], ['key', 'beatKey']]) {
      if (!excluded.includes(key) && options[key] && String(track[field] || '').trim().toLocaleLowerCase() !== String(options[key]).trim().toLocaleLowerCase()) return false;
    }
    if (!excluded.includes('bpm')) {
      if (!matchesBpm(track, options.bpm)) return false;
      if (options.bpmMin !== undefined && options.bpmMin !== '' && !(Number(track.beatBpm) >= Number(options.bpmMin))) return false;
      if (options.bpmMax !== undefined && options.bpmMax !== '' && !(Number(track.beatBpm) <= Number(options.bpmMax))) return false;
    }
    return true;
  };
  const items = eligible.filter((track) => matches(track)).sort((a, b) => {
    const rank = sort === 'liked' ? Number(b.likes || 0) - Number(a.likes || 0)
      : ['played', 'trending'].includes(sort) ? Number(b.plays || 0) - Number(a.plays || 0) : 0;
    return rank || new Date(b.publishedAt || b.createdAt || b.releaseDate || 0) - new Date(a.publishedAt || a.createdAt || a.releaseDate || 0) || String(b.id).localeCompare(String(a.id));
  });
  const count = (excluded, getValue, label = (value) => value) => {
    const values = new Map();
    eligible.filter((track) => matches(track, [excluded])).forEach((track) => {
      const value = getValue(track);
      if (value) values.set(value, (values.get(value) || 0) + 1);
    });
    return [...values].map(([value, count]) => ({ value, label: label(value), count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  const facets = {
    genres: count('taxonomy', (track) => normalizeGenre(track.genre), getGenreLabel),
    groups: count('taxonomy', (track) => getGroupOf(track.genre)),
    styles: count('style', (track) => track.beatStyle),
    moods: count('mood', (track) => track.beatMood),
    keys: count('key', (track) => track.beatKey),
    bpmRanges: ['under-90', '90-119', '120-149', '150-plus'].map((value) => ({ value, label: value, count: eligible.filter((track) => matches(track, ['bpm']) && normalizeTrackContentType(track.contentType) === 'BEAT' && matchesBpm(track, value)).length })),
  };
  const fingerprint = JSON.stringify(Object.entries(options).filter(([key, value]) => !['cursor', 'enabled', 'page'].includes(key) && value !== '').sort());
  let offset = 0;
  if (options.cursor) {
    let cursor;
    try { cursor = JSON.parse(decodeURIComponent(options.cursor)); } catch { throw new Error('Invalid catalog cursor'); }
    if (cursor.query !== fingerprint || !Number.isInteger(cursor.offset) || cursor.offset < 0) throw new Error('Catalog cursor does not match query');
    offset = cursor.offset;
  }
  const page = items.slice(offset, offset + limit);
  const hasNextPage = offset + page.length < items.length;
  return {
    items: page, total: items.length,
    pageInfo: { hasNextPage, pageSize: limit, nextCursor: hasNextPage ? encodeURIComponent(JSON.stringify({ query: fingerprint, offset: offset + page.length })) : null },
    facets,
    meta: { sort, trendingWindowDays: null, rankingAsOf: null },
  };
}
