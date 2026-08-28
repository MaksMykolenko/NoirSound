import { mockTracks } from './data';
import { normalizeTrackContentType } from '../../utils/trackContent';

function filterByContentType(tracks, options = {}) {
  const requested = typeof options === 'string' ? options : options?.contentType;
  if (!requested) return tracks;
  const normalized = normalizeTrackContentType(requested);
  return tracks.filter((track) => normalizeTrackContentType(track.contentType) === normalized);
}

export async function getTracks(options = {}) {
  return filterByContentType([...mockTracks], options);
}

export async function getTrackById(id) {
  const track = mockTracks.find((item) => item.id === id);
  if (!track) throw new Error('Track not found');
  return track;
}

export async function getTracksByArtist(artistId, options = {}) {
  return filterByContentType(mockTracks.filter((track) => track.artistId === artistId), options);
}

export async function getDiscoverTracks(options = {}) {
  return filterByContentType([...mockTracks], options);
}

export async function searchTracks(query, options = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  return filterByContentType(mockTracks, options).filter((track) =>
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

export async function setTrackLiked() {
  return { success: true };
}

export async function getLikedTracks(options = {}) {
  return filterByContentType([...mockTracks].slice(0, 3), options);
}
