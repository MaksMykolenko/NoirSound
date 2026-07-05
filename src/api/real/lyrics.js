import { apiFetch } from '../client';

export function getTrackLyrics(trackId) {
  return apiFetch(`/tracks/${encodeURIComponent(trackId)}/lyrics`, {
    suppressErrorToast: true,
  });
}

export function getManageTrackLyrics(trackId) {
  return apiFetch(`/tracks/${encodeURIComponent(trackId)}/lyrics/manage`, {
    suppressErrorToast: true,
  });
}

export function updateTrackLyrics(trackId, payload) {
  return apiFetch(`/tracks/${encodeURIComponent(trackId)}/lyrics`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
