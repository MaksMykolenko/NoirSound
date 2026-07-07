import { mapTrackResponse } from './trackMapper';
import { API_BASE_URL } from '../client';

export function mapPlaylistResponse(backendPlaylist) {
  if (!backendPlaylist) return null;
  const creator = backendPlaylist.creator || backendPlaylist.owner;
  const trackEntries = Array.isArray(backendPlaylist.tracks) ? backendPlaylist.tracks : [];
  const tracks = trackEntries
    .map((entry) => mapTrackResponse(entry.track || entry))
    .filter(Boolean);
  const creatorName = typeof creator === 'string'
    ? creator
    : creator?.displayName?.trim() || creator?.username?.trim()
      || backendPlaylist.creatorName?.trim()
      || 'Unknown creator';

  return {
    ...backendPlaylist,
    id: backendPlaylist.id,
    name: (backendPlaylist.name ?? backendPlaylist.title)?.trim() || 'Untitled playlist',
    title: (backendPlaylist.name ?? backendPlaylist.title)?.trim() || 'Untitled playlist',
    description: backendPlaylist.description || '',
    creator: creatorName,
    creatorName,
    creatorId: backendPlaylist.creatorId || (typeof creator === 'object' ? creator?.id : null),
    ownerArtistId: backendPlaylist.ownerArtistId
      || (typeof creator === 'object' ? creator?.artistProfile?.id : null),
    coverUrl: backendPlaylist.hasCoverImage
      ? `${API_BASE_URL}/public/playlist-covers/${backendPlaylist.id}`
      : backendPlaylist.coverUrl || null,
    likes: Number(backendPlaylist.likes || 0),
    trackCount: Number(backendPlaylist.trackCount ?? tracks.length),
    durationSeconds: Number(backendPlaylist.durationSeconds || 0),
    tracks,
    trackEntries: trackEntries.map((entry, index) => ({
      id: entry.id || `${backendPlaylist.id}:${entry.trackId || entry.track?.id || index}`,
      trackId: entry.trackId || entry.track?.id || entry.id,
      position: Number(entry.position ?? entry.order ?? index + 1),
      addedAt: entry.addedAt || null,
    })),
    trackIds: tracks.map((track) => track.id),
    isPublic: backendPlaylist.isPublic !== false,
    visibility: backendPlaylist.visibility || (backendPlaylist.isPublic === false ? 'PRIVATE' : 'PUBLIC'),
    isOwner: Boolean(backendPlaylist.isOwner || backendPlaylist.createdByCurrentUser),
    isSaved: Boolean(backendPlaylist.isSaved || backendPlaylist.likedByCurrentUser),
    canEdit: Boolean(backendPlaylist.canEdit || backendPlaylist.createdByCurrentUser),
    canDelete: Boolean(backendPlaylist.canDelete || backendPlaylist.createdByCurrentUser),
    canReorder: Boolean(backendPlaylist.canReorder || backendPlaylist.createdByCurrentUser),
    createdByCurrentUser: Boolean(backendPlaylist.isOwner || backendPlaylist.createdByCurrentUser),
    likedByCurrentUser: Boolean(backendPlaylist.isSaved || backendPlaylist.likedByCurrentUser)
  };
}
