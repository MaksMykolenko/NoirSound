import { apiFetch } from '../client';

export function getTrackLyrics(trackId, track = null) {
  const endpoint = track?.importedPlaylistId
    ? `/playlist-import/source/${encodeURIComponent(track.importedPlaylistId)}/lyrics/${encodeURIComponent(track.position)}`
    : track?.previewExternalId && !track.recordingId
      ? `/external-catalog/preview/${encodeURIComponent(track.previewExternalId)}/lyrics`
      : `/tracks/${encodeURIComponent(trackId)}/lyrics`;
  return apiFetch(endpoint, {
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
