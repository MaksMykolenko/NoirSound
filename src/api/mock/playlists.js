import { mockPlaylists, mockTracks } from './data';

let playlistState = mockPlaylists.map((playlist) => ({
  ...playlist,
  trackIds: [...(playlist.trackIds || [])],
  isPublic: playlist.isPublic !== false,
  isOwner: Boolean(playlist.createdByCurrentUser),
  isSaved: !playlist.createdByCurrentUser,
}));

function detail(playlist) {
  const tracks = (playlist.trackIds || [])
    .map((trackId) => mockTracks.find((track) => track.id === trackId))
    .filter(Boolean);
  return {
    ...playlist,
    tracks,
    trackCount: tracks.length,
    durationSeconds: tracks.reduce((total, track) => total + Number(track.duration || 0), 0),
    canEdit: Boolean(playlist.isOwner),
    canDelete: Boolean(playlist.isOwner),
    canReorder: Boolean(playlist.isOwner),
    createdByCurrentUser: Boolean(playlist.isOwner),
    likedByCurrentUser: Boolean(playlist.isSaved),
  };
}

function findPlaylist(id) {
  const playlist = playlistState.find((item) => item.id === id);
  if (!playlist) throw new Error('Playlist not found');
  return playlist;
}

export async function getPlaylists() {
  return playlistState.filter((playlist) => playlist.isPublic).map(detail);
}

export async function getPlaylistById(id) {
  return detail(findPlaylist(id));
}

export async function createPlaylist(playlistData) {
  const playlist = {
    id: `demo-playlist-${Date.now()}`,
    ...playlistData,
    name: playlistData.name || playlistData.title,
    creator: 'Demo Listener',
    creatorName: 'Demo Listener',
    coverUrl: null,
    likes: 0,
    trackIds: [],
    isOwner: true,
    isSaved: false,
    createdByCurrentUser: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  playlistState = [playlist, ...playlistState];
  return detail(playlist);
}

export async function getMyPlaylists() {
  return playlistState.filter((playlist) => playlist.isOwner || playlist.isSaved).map(detail);
}

export async function updatePlaylist(id, updates) {
  const playlist = findPlaylist(id);
  if (!playlist.isOwner) throw new Error('Playlist cannot be edited.');
  Object.assign(playlist, {
    ...updates,
    name: updates.name || updates.title || playlist.name,
    updatedAt: new Date().toISOString(),
  });
  return detail(playlist);
}

export async function deletePlaylist(id) {
  const playlist = findPlaylist(id);
  if (!playlist.isOwner) throw new Error('Playlist cannot be deleted.');
  playlistState = playlistState.filter((item) => item.id !== id);
}

export async function addTrackToPlaylist(id, trackId) {
  const playlist = findPlaylist(id);
  if (!playlist.isOwner) throw new Error('Playlist cannot be edited.');
  if (playlist.trackIds.includes(trackId)) {
    const error = new Error('Track is already in this playlist.');
    error.code = 'PLAYLIST_TRACK_ALREADY_EXISTS';
    throw error;
  }
  const track = mockTracks.find((item) => item.id === trackId);
  if (!track) throw new Error('Track is unavailable.');
  playlist.trackIds.push(trackId);
  playlist.updatedAt = new Date().toISOString();
  return { entry: { trackId, position: playlist.trackIds.length, track } };
}

export async function removeTrackFromPlaylist(id, trackId) {
  const playlist = findPlaylist(id);
  if (!playlist.isOwner) throw new Error('Playlist cannot be edited.');
  playlist.trackIds = playlist.trackIds.filter((item) => item !== trackId);
}

export async function reorderPlaylistTracks(id, trackIds) {
  const playlist = findPlaylist(id);
  if (!playlist.isOwner) throw new Error('Playlist cannot be reordered.');
  if (
    trackIds.length !== playlist.trackIds.length
    || trackIds.some((trackId) => !playlist.trackIds.includes(trackId))
  ) {
    throw new Error('Playlist order is invalid.');
  }
  playlist.trackIds = [...trackIds];
  return { success: true, trackIds };
}

export async function setPlaylistSaved(id, saved) {
  const playlist = findPlaylist(id);
  playlist.isSaved = saved;
  playlist.likes = Math.max(0, Number(playlist.likes || 0) + (saved ? 1 : -1));
  return { success: true, isSaved: saved };
}

export async function uploadPlaylistCover(id, file) {
  const playlist = findPlaylist(id);
  if (!playlist.isOwner) throw new Error('Playlist cannot be edited.');
  playlist.coverUrl = typeof URL !== 'undefined' && URL.createObjectURL
    ? URL.createObjectURL(file)
    : playlist.coverUrl;
  return detail(playlist);
}
