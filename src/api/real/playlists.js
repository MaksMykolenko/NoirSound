import { apiFetch } from '../client';
import { mapPlaylistResponse } from '../mappers/playlistMapper';

export async function getPlaylists() {
  const response = await apiFetch('/playlists');
  const data = response?.data ?? response;
  if (!Array.isArray(data)) return [];
  return data.map(mapPlaylistResponse).filter(Boolean);
}

export async function getPlaylistById(id) {
  const response = await apiFetch(`/playlists/${id}`);
  return mapPlaylistResponse(response.playlist ?? response);
}

export async function createPlaylist(playlistData) {
  const response = await apiFetch('/playlists', {
    method: 'POST',
    body: JSON.stringify(playlistData),
  });
  return {
    ...mapPlaylistResponse(response.playlist ?? response),
    createdByCurrentUser: true,
  };
}

export async function getMyPlaylists() {
  const response = await apiFetch('/playlists/me');
  const data = response?.data ?? response;
  if (!Array.isArray(data)) return [];
  return data.map(mapPlaylistResponse).filter(Boolean);
}
