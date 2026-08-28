import { apiFetch } from '../client';
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
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export async function getTracks(options = {}) {
  return mapTrackList(await apiFetch(`/tracks${trackQuery(options)}`));
}

export async function getTrackById(id) {
  const response = await apiFetch(`/tracks/${id}`);
  return mapTrackResponse(response.track ?? response);
}

export async function getTracksByArtist(artistId, options = {}) {
  return mapTrackList(await apiFetch(`/artists/${artistId}/tracks${trackQuery(options)}`));
}

export async function getDiscoverTracks(options = {}) {
  return getTracks(options);
}

export async function searchTracks(query, options = {}) {
  const tracks = await getTracks(options);
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return tracks;
  return tracks.filter((track) =>
    [
      track.title,
      track.artistName,
      track.genre,
      track.beatMood,
      track.beatStyle,
      track.beatKey,
      ...(track.tags || []),
    ]
      .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
  );
}

export async function setTrackLiked(trackId, liked) {
  return apiFetch(`/tracks/${trackId}/like`, {
    method: liked ? 'POST' : 'DELETE',
  });
}

export async function getLikedTracks(options = {}) {
  return mapTrackList(await apiFetch(`/me/liked-tracks${trackQuery(options)}`));
}
