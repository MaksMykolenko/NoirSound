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

export async function updatePlaylist(id, updates) {
  const response = await apiFetch(`/playlists/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return mapPlaylistResponse(response.playlist ?? response);
}

export async function deletePlaylist(id) {
  await apiFetch(`/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function addTrackToPlaylist(id, trackId) {
  return apiFetch(`/playlists/${encodeURIComponent(id)}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ trackId }),
  });
}

export async function removeTrackFromPlaylist(id, trackId) {
  await apiFetch(
    `/playlists/${encodeURIComponent(id)}/tracks/${encodeURIComponent(trackId)}`,
    { method: 'DELETE' }
  );
}

export async function reorderPlaylistTracks(id, trackIds) {
  return apiFetch(`/playlists/${encodeURIComponent(id)}/tracks/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ trackIds }),
  });
}

export async function setPlaylistSaved(id, saved) {
  return apiFetch(`/playlists/${encodeURIComponent(id)}/save`, {
    method: saved ? 'POST' : 'DELETE',
  });
}

export async function uploadPlaylistCover(id, file) {
  const init = await apiFetch(`/playlists/${encodeURIComponent(id)}/cover/init`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    }),
  });
  const uploadResponse = await fetch(init.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadResponse.ok) throw new Error('Playlist cover upload failed.');
  const response = await apiFetch(`/playlists/${encodeURIComponent(id)}/cover/complete`, {
    method: 'POST',
    body: JSON.stringify({ coverKey: init.coverKey }),
  });
  return mapPlaylistResponse(response.playlist ?? response);
}
