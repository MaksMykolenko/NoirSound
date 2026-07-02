import { apiFetch } from '../client';
import { mapTrackResponse } from '../mappers/trackMapper';

export async function getListeningStats() {
  return apiFetch('/me/listening-stats');
}

export async function recordPlayEvent(trackId, event) {
  return apiFetch(`/tracks/${trackId}/play-event`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function getRecentlyPlayed() {
  const response = await apiFetch('/me/recently-played');
  const data = response?.data ?? response;
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => mapTrackResponse(item.track))
    .filter(Boolean);
}

export async function getArtistDashboard() {
  return apiFetch('/me/artist-dashboard');
}
