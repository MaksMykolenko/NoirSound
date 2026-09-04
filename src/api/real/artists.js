import { apiFetch } from '../client';
import { mapArtistResponse } from '../mappers/artistMapper';

export async function getArtists() {
  const response = await apiFetch('/artists');
  const data = response?.data ?? response;
  if (!Array.isArray(data)) return [];
  return data.map(mapArtistResponse).filter(Boolean);
}

/** Returns only artists that have at least one PUBLISHED track. */
export async function getArtistsWithTracks(options = {}, requestOptions = {}) {
  const search = new URLSearchParams({ hasPublishedTracks: 'true' });
  if (options.contentType && options.contentType !== 'ALL') search.set('contentType', options.contentType);
  if (options.sort) search.set('sort', options.sort);
  if (options.limit) search.set('limit', String(options.limit));
  const response = await apiFetch(`/artists?${search.toString()}`, requestOptions);
  const data = response?.data ?? response;
  if (!Array.isArray(data)) return [];
  return data.map(mapArtistResponse).filter(Boolean);
}

export async function getArtistById(id) {
  const response = await apiFetch(`/artists/${id}`);
  return mapArtistResponse(response.artist ?? response);
}

export async function followArtist(id) {
  return apiFetch(`/artists/${id}/follow`, { method: 'POST' });
}

export async function unfollowArtist(id) {
  return apiFetch(`/artists/${id}/unfollow`, { method: 'POST' });
}

export async function getFollowedArtists() {
  const response = await apiFetch('/me/followed-artists');
  const data = response?.data ?? response;
  if (!Array.isArray(data)) return [];
  return data.map(mapArtistResponse).filter(Boolean);
}
