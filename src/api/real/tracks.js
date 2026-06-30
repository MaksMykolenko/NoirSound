import { apiFetch } from '../client';
import { mapTrackResponse } from '../mappers/trackMapper';

function mapTrackList(response) {
  const data = response?.data ?? response;
  if (!Array.isArray(data)) return [];
  return data.map(mapTrackResponse).filter(Boolean);
}

export async function getTracks() {
  return mapTrackList(await apiFetch('/tracks'));
}

export async function getTrackById(id) {
  const response = await apiFetch(`/tracks/${id}`);
  return mapTrackResponse(response.track ?? response);
}

export async function getTracksByArtist(artistId) {
  return mapTrackList(await apiFetch(`/artists/${artistId}/tracks`));
}

export async function getDiscoverTracks() {
  return getTracks();
}

export async function searchTracks(query) {
  const tracks = await getTracks();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return tracks;
  return tracks.filter((track) =>
    [track.title, track.artistName, track.genre, ...(track.tags || [])]
      .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
  );
}

export async function setTrackLiked(trackId, liked) {
  return apiFetch(`/tracks/${trackId}/like`, {
    method: liked ? 'POST' : 'DELETE',
  });
}

export async function getLikedTracks() {
  return mapTrackList(await apiFetch('/me/liked-tracks'));
}
