import { mockTracks } from './data';

export async function getTracks() {
  return [...mockTracks];
}

export async function getTrackById(id) {
  const track = mockTracks.find((item) => item.id === id);
  if (!track) throw new Error('Track not found');
  return track;
}

export async function getTracksByArtist(artistId) {
  return mockTracks.filter((track) => track.artistId === artistId);
}

export async function getDiscoverTracks() {
  return [...mockTracks];
}

export async function searchTracks(query) {
  const normalizedQuery = query.trim().toLowerCase();
  return mockTracks.filter((track) =>
    [track.title, track.artistName, track.genre, ...(track.tags || [])]
      .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
  );
}

export async function setTrackLiked() {
  return { success: true };
}

export async function getLikedTracks() {
  return [...mockTracks].slice(0, 3);
}
