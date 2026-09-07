import { apiFetch, API_BASE_URL } from '../client';
import { mapTrackResponse } from '../mappers/trackMapper';

function mapTrackList(response) {
  const data = response?.data ?? response;
  if (!Array.isArray(data)) return [];
  return data.map(mapTrackResponse).filter(Boolean);
}

function trackQuery(options = {}) {
  const contentType = typeof options === 'string' ? options : options?.contentType;
  const query = typeof options === 'object' ? options?.query?.trim() : '';
  const search = new URLSearchParams();
  if (contentType) search.set('contentType', contentType);
  if (query) search.set('q', query);
  if (typeof options === 'object') {
    for (const key of ['style', 'mood', 'key', 'bpm', 'genre', 'group', 'sort', 'limit', 'page']) {
      const value = options?.[key];
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value));
      }
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export async function getTracks(options = {}, requestOptions = {}) {
  return mapTrackList(await apiFetch(`/tracks${trackQuery(options)}`, requestOptions));
}

export async function getTrackById(id) {
  const response = await apiFetch(`/tracks/${id}`);
  return mapTrackResponse(response.track ?? response);
}

export async function getTracksByArtist(artistId, options = {}) {
  return mapTrackList(await apiFetch(`/artists/${artistId}/tracks${trackQuery(options)}`));
}

export async function getDiscoverTracks(options = {}, requestOptions = {}) {
  return getTracks(options, requestOptions);
}

export async function getTrendingTracks(options = {}, requestOptions = {}) {
  const response = await apiFetch(`/tracks${trackQuery({ ...options, sort: 'trending' })}`, requestOptions);
  return {
    tracks: mapTrackList(response),
    meta: response?.meta || {},
  };
}

export async function getCatalogTracks(options = {}, requestOptions = {}) {
  const search = new URLSearchParams();
  const q = String(options.q ?? options.query ?? '').trim();
  if (q) search.set('q', q);
  for (const key of ['contentType', 'genre', 'group', 'style', 'mood', 'bpm', 'bpmMin', 'bpmMax', 'key', 'sort', 'cursor', 'limit']) {
    const value = options[key];
    if (value !== undefined && value !== null && value !== '' && !(key === 'contentType' && value === 'ALL')) search.set(key, String(value));
  }
  const response = await apiFetch(`/discover/catalog?${search}`, requestOptions);
  if (!Array.isArray(response?.items) || !Number.isFinite(response.total) || response.total < 0
    || typeof response.pageInfo?.hasNextPage !== 'boolean'
    || (response.pageInfo.hasNextPage && typeof response.pageInfo.nextCursor !== 'string')
    || !['genres', 'groups', 'styles', 'moods', 'keys', 'bpmRanges'].every((key) => Array.isArray(response.facets?.[key]))) {
    throw new Error('Invalid catalog response');
  }
  return { ...response, items: response.items.map(mapTrackResponse).filter(Boolean) };
}

// Compatibility: search consumers still receive mapped Track[], but the
// search itself is applied by the catalog endpoint before its bounded page.
export async function searchTracks(query, options = {}, requestOptions = {}) {
  const response = await getCatalogTracks({ ...options, q: query }, requestOptions);
  return response.items;
}

export async function setTrackLiked(trackId, liked) {
  return apiFetch(`/tracks/${trackId}/like`, {
    method: liked ? 'POST' : 'DELETE',
  });
}

export async function getLikedTracks(options = {}) {
  return mapTrackList(await apiFetch(`/me/liked-tracks${trackQuery(options)}`));
}

export async function getLandingShowcase(requestOptions = {}) {
  const response = await apiFetch('/landing/showcase', { ...requestOptions, suppressErrorToast: true });
  const data = response?.data;
  if (!Array.isArray(data?.MUSIC) || !Array.isArray(data?.BEAT)) throw new Error('Invalid showcase response');
  const group = (type) => data[type].slice(0, 3).map(raw => {
    const track = mapTrackResponse(raw);
    if (!track) return null;
    const base = `${API_BASE_URL}/landing/tracks/${encodeURIComponent(track.id)}`;
    return { ...track, hasLyrics: import.meta.env.VITE_PUBLIC_APP_ENABLED !== 'false' && track.hasLyrics, audioUrl: track.isStreamable ? `${base}/stream` : null, coverUrl: raw.hasCoverImage ? `${base}/cover` : null, playbackSource: 'landing' };
  })
    .filter(track => track?.contentType === type && track.isStreamable && track.audioUrl && track.isAvailable !== false);
  return { MUSIC: group('MUSIC'), BEAT: group('BEAT') };
}
