import {
  ArrowDownToLine,
  CircleUserRound,
  Copy,
  FileText,
  Heart,
  ListEnd,
  ListMusic,
  Pause,
  Pencil,
  Play,
  Radio,
  Save,
  Share2,
  Shuffle,
  Trash2,
  UserPlus,
  UserRoundCheck,
  X,
  ArrowUp,
  ArrowDown,
  Globe2,
  Lock,
} from 'lucide-react';

export const menuSeparator = (id) => ({ id, type: 'separator' });
const text = (t, key, fallback, options = {}) => (
  t ? t(key, { defaultValue: fallback, ...options }) : fallback
);

async function copyUrl(path, successMessage, addToast) {
  const url = new URL(path, window.location.origin).toString();
  await navigator.clipboard.writeText(url);
  addToast?.(successMessage || 'Link copied.', 'success');
}

async function shareUrl(path, title, addToast) {
  const url = new URL(path, window.location.origin).toString();
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await navigator.clipboard.writeText(url);
  addToast?.('Link copied.', 'success');
}

export function buildTrackContextActions({
  track,
  player,
  navigate,
  addToast,
  openAddToPlaylist,
  removeFromQueue,
  removeFromPlaylist,
  moveUp,
  moveDown,
  t,
}) {
  if (!track) return [];
  const canPlay = track.isStreamable ?? Boolean(track.audioUrl);
  const isCurrent = player.currentTrack?.id === track.id;
  const isLiked = (player.likedTracks || []).includes(track.id);
  const inQueue = (player.queue || []).some((item) => item.id === track.id);
  return [
    {
      id: 'track-play',
      label: isCurrent && player.isPlaying
        ? text(t, 'contextMenu.pause', 'Pause')
        : text(t, 'contextMenu.play', 'Play'),
      icon: isCurrent && player.isPlaying ? Pause : Play,
      disabled: !canPlay || typeof player.playNext !== 'function',
      onSelect: () => (isCurrent ? player.togglePlay() : player.playTrack(track)),
    },
    {
      id: 'track-play-next',
      label: text(t, 'contextMenu.playNext', 'Play next'),
      icon: ListEnd,
      disabled: !canPlay,
      onSelect: () => player.playNext?.(track),
    },
    {
      id: 'track-queue',
      label: inQueue
        ? text(t, 'contextMenu.alreadyInQueue', 'Already in queue')
        : text(t, 'contextMenu.addToQueue', 'Add to queue'),
      icon: ArrowDownToLine,
      disabled: !canPlay || inQueue,
      checked: inQueue,
      onSelect: () => player.addToQueue?.(track),
    },
    removeFromQueue && {
      id: 'track-remove-queue',
      label: text(t, 'contextMenu.removeFromQueue', 'Remove from queue'),
      icon: X,
      onSelect: removeFromQueue,
    },
    moveUp && {
      id: 'track-move-up',
      label: text(t, 'contextMenu.moveUp', 'Move up'),
      icon: ArrowUp,
      disabled: moveUp.disabled,
      onSelect: moveUp.action || moveUp,
    },
    moveDown && {
      id: 'track-move-down',
      label: text(t, 'contextMenu.moveDown', 'Move down'),
      icon: ArrowDown,
      disabled: moveDown.disabled,
      onSelect: moveDown.action || moveDown,
    },
    menuSeparator('track-library-separator'),
    {
      id: 'track-playlist',
      label: text(t, 'contextMenu.addToPlaylist', 'Add to playlist'),
      icon: ListMusic,
      onSelect: () => openAddToPlaylist(track),
    },
    {
      id: 'track-like',
      label: isLiked
        ? text(t, 'contextMenu.unlikeTrack', 'Unlike track')
        : text(t, 'contextMenu.likeTrack', 'Like track'),
      icon: Heart,
      checked: isLiked,
      onSelect: () => player.toggleLikeTrack(track.id),
    },
    removeFromPlaylist && {
      id: 'track-remove-playlist',
      label: text(t, 'contextMenu.removeFromPlaylist', 'Remove from this playlist'),
      icon: Trash2,
      danger: true,
      onSelect: removeFromPlaylist,
    },
    menuSeparator('track-navigation-separator'),
    {
      id: 'track-open',
      label: text(t, 'contextMenu.goToTrack', 'Go to track'),
      icon: Radio,
      onSelect: () => navigate(`/track/${track.id}`),
    },
    track.artistId && {
      id: 'track-artist',
      label: text(t, 'contextMenu.goToArtist', 'Go to artist'),
      icon: CircleUserRound,
      onSelect: () => navigate(`/artist/${track.artistId}`),
    },
    {
      id: 'track-lyrics',
      label: text(t, 'contextMenu.openLyrics', 'Open lyrics'),
      icon: FileText,
      disabled: !track.hasLyrics && !track.lyrics,
      onSelect: () => {
        if (!isCurrent) player.playTrack(track);
        player.openLyricsFullscreen();
      },
    },
    menuSeparator('track-share-separator'),
    {
      id: 'track-share',
      label: text(t, 'contextMenu.share', 'Share'),
      icon: Share2,
      onSelect: () => shareUrl(`/track/${track.id}`, track.title, addToast),
    },
    {
      id: 'track-copy',
      label: text(t, 'contextMenu.copyLink', 'Copy link'),
      icon: Copy,
      onSelect: () => copyUrl(`/track/${track.id}`, 'Track link copied.', addToast),
    },
  ].filter(Boolean);
}

export function buildPlaylistContextActions({
  playlist,
  player,
  navigate,
  addToast,
  onToggleSaved,
  onEdit,
  onDelete,
  onToggleVisibility,
  resolvePlaylistTracks,
  t,
}) {
  if (!playlist) return [];
  const tracks = playlist.tracks || [];
  const playable = tracks.filter((track) => track.isStreamable ?? Boolean(track.audioUrl));
  const canResolveTracks = playable.length > 0 || Number(playlist.trackCount || 0) > 0;
  const loadPlayableTracks = async () => {
    if (playable.length > 0) return playable;
    const resolved = await resolvePlaylistTracks?.();
    return (resolved || []).filter((track) => track.isStreamable ?? Boolean(track.audioUrl));
  };
  const owner = playlist.isOwner || playlist.canEdit || playlist.createdByCurrentUser;
  return [
    {
      id: 'playlist-play',
      label: text(t, 'contextMenu.playPlaylist', 'Play playlist'),
      icon: Play,
      disabled: !canResolveTracks,
      onSelect: async () => {
        const nextTracks = await loadPlayableTracks();
        if (nextTracks.length === 0) return;
        return player.playTrack(nextTracks[0], nextTracks, {
          type: 'playlist',
          id: playlist.id,
          name: playlist.name,
        });
      },
    },
    {
      id: 'playlist-shuffle',
      label: text(t, 'contextMenu.shufflePlay', 'Shuffle play'),
      icon: Shuffle,
      disabled: !canResolveTracks,
      onSelect: async () => {
        const nextTracks = await loadPlayableTracks();
        if (nextTracks.length === 0) return;
        const shuffled = [...nextTracks].sort(() => Math.random() - 0.5);
        return player.playTrack(shuffled[0], shuffled, { type: 'playlist', id: playlist.id, name: playlist.name });
      },
    },
    {
      id: 'playlist-queue',
      label: text(t, 'contextMenu.addPlaylistToQueue', 'Add playlist to queue'),
      icon: ArrowDownToLine,
      disabled: !canResolveTracks,
      onSelect: async () => player.addTracksToQueue(await loadPlayableTracks()),
    },
    !owner && {
      id: 'playlist-save',
      label: playlist.isSaved
        ? text(t, 'contextMenu.removeFromLibrary', 'Remove from library')
        : text(t, 'contextMenu.saveToLibrary', 'Save to library'),
      icon: Save,
      checked: playlist.isSaved,
      onSelect: onToggleSaved,
    },
    menuSeparator('playlist-navigation-separator'),
    {
      id: 'playlist-open',
      label: text(t, 'contextMenu.openPlaylist', 'Open playlist'),
      icon: ListMusic,
      onSelect: () => navigate(`/playlist/${playlist.id}`),
    },
    owner && {
      id: 'playlist-edit',
      label: text(t, 'contextMenu.editPlaylist', 'Edit playlist'),
      icon: Pencil,
      onSelect: onEdit || (() => navigate(`/playlist/${playlist.id}`, { state: { openPlaylistEdit: true } })),
    },
    owner && onToggleVisibility && {
      id: 'playlist-visibility',
      label: playlist.isPublic
        ? text(t, 'contextMenu.makePrivate', 'Make private')
        : text(t, 'contextMenu.makePublic', 'Make public'),
      icon: playlist.isPublic ? Lock : Globe2,
      onSelect: onToggleVisibility,
    },
    owner && {
      id: 'playlist-delete',
      label: text(t, 'contextMenu.deletePlaylist', 'Delete playlist'),
      icon: Trash2,
      danger: true,
      onSelect: onDelete || (() => navigate(`/playlist/${playlist.id}`, { state: { openPlaylistDelete: true } })),
    },
    menuSeparator('playlist-share-separator'),
    {
      id: 'playlist-share',
      label: text(t, 'contextMenu.share', 'Share'),
      icon: Share2,
      disabled: playlist.isPublic === false,
      onSelect: () => shareUrl(`/playlist/${playlist.id}`, playlist.name, addToast),
    },
    {
      id: 'playlist-copy',
      label: text(t, 'contextMenu.copyLink', 'Copy link'),
      icon: Copy,
      disabled: playlist.isPublic === false,
      onSelect: () => copyUrl(`/playlist/${playlist.id}`, 'Playlist link copied.', addToast),
    },
  ].filter(Boolean);
}

export function buildArtistContextActions({
  artist,
  navigate,
  addToast,
  isFollowing,
  onToggleFollow,
  t,
}) {
  if (!artist) return [];
  return [
    {
      id: 'artist-open',
      label: text(t, 'contextMenu.goToArtist', 'Go to artist'),
      icon: CircleUserRound,
      onSelect: () => navigate(`/artist/${artist.id}`),
    },
    onToggleFollow && {
      id: 'artist-follow',
      label: isFollowing
        ? text(t, 'contextMenu.unfollowArtist', 'Unfollow artist')
        : text(t, 'contextMenu.followArtist', 'Follow artist'),
      icon: isFollowing ? UserRoundCheck : UserPlus,
      checked: isFollowing,
      onSelect: onToggleFollow,
    },
    menuSeparator('artist-share-separator'),
    {
      id: 'artist-share',
      label: text(t, 'contextMenu.share', 'Share'),
      icon: Share2,
      onSelect: () => shareUrl(`/artist/${artist.id}`, artist.name, addToast),
    },
    {
      id: 'artist-copy',
      label: text(t, 'contextMenu.copyLink', 'Copy link'),
      icon: Copy,
      onSelect: () => copyUrl(`/artist/${artist.id}`, 'Artist link copied.', addToast),
    },
  ].filter(Boolean);
}
