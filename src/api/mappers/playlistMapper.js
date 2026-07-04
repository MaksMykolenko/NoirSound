import { mapTrackResponse } from './trackMapper';
import { API_BASE_URL } from '../client';

export function mapPlaylistResponse(backendPlaylist) {
  if (!backendPlaylist) return null;
  if (backendPlaylist.creatorName && !backendPlaylist.creator) return backendPlaylist;

  return {
    id: backendPlaylist.id,
    name: backendPlaylist.name?.trim() || 'Untitled playlist',
    title: backendPlaylist.name?.trim() || 'Untitled playlist',
    description: backendPlaylist.description || '',
    creator: backendPlaylist.creator?.displayName?.trim()
      || backendPlaylist.creator?.username?.trim()
      || 'Unknown creator',
    creatorName: backendPlaylist.creator?.displayName?.trim()
      || backendPlaylist.creator?.username?.trim()
      || 'Unknown creator',
    coverUrl: backendPlaylist.hasCoverImage
      ? `${API_BASE_URL}/public/playlist-covers/${backendPlaylist.id}`
      : backendPlaylist.coverUrl || null,
    likes: Number(backendPlaylist.likes || 0),
    trackCount: backendPlaylist.tracks ? backendPlaylist.tracks.length : 0,
    tracks: backendPlaylist.tracks ? backendPlaylist.tracks.map(pt => mapTrackResponse(pt.track)) : [],
    trackIds: backendPlaylist.tracks ? backendPlaylist.tracks.map(pt => pt.track.id) : [],
    isPublic: backendPlaylist.isPublic,
    createdByCurrentUser: false,
    likedByCurrentUser: false
  };
}
