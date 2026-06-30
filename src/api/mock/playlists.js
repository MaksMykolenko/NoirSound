import { mockPlaylists, mockTracks } from './data';

export async function getPlaylists() {
  return [...mockPlaylists];
}

export async function getPlaylistById(id) {
  const playlist = mockPlaylists.find((item) => item.id === id);
  if (!playlist) throw new Error('Playlist not found');
  const tracks = (playlist.trackIds || [])
    .map((trackId) => mockTracks.find((track) => track.id === trackId))
    .filter(Boolean);
  return { ...playlist, tracks };
}

export async function createPlaylist(playlistData) {
  return {
    id: `demo-playlist-${Date.now()}`,
    ...playlistData,
    creator: 'Demo Listener',
    coverUrl: '/images/cover_lofi.png',
    likes: 0,
    trackIds: [],
    tracks: [],
    createdByCurrentUser: true,
  };
}

export async function getMyPlaylists() {
  return [...mockPlaylists];
}
