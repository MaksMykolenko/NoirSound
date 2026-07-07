import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MoreHorizontal, Pin, Play } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import FallbackCover from '../ui/FallbackCover';
import { usePlaylistContextMenu } from '../../hooks/useEntityContextMenu';
import { getPlaylistById } from '../../api/playlists';

export default function SidebarPlaylistItem({ playlist, onToggleSaved, onEdit, onDelete }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { playTrack } = usePlayerStore();
  const { contextMenuProps, openFromButton } = usePlaylistContextMenu(playlist, {
    onToggleSaved,
    onEdit,
    onDelete,
  });

  const isActive = location.pathname === `/playlist/${playlist.id}`;

  const handlePlayClick = async (e) => {
    e.stopPropagation();
    let tracksInPlaylist = playlist.tracks || [];
    if (tracksInPlaylist.length === 0 && Number(playlist.trackCount || 0) > 0) {
      try {
        tracksInPlaylist = (await getPlaylistById(playlist.id))?.tracks || [];
      } catch {
        return;
      }
    }
    if (tracksInPlaylist.length > 0) {
      playTrack(tracksInPlaylist[0], tracksInPlaylist);
    }
  };

  const handleRowClick = () => {
    navigate(`/playlist/${playlist.id}`);
  };

  return (
    <div
      onClick={handleRowClick}
      onContextMenu={contextMenuProps.onContextMenu}
      onKeyDown={(event) => {
        contextMenuProps.onKeyDown(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleRowClick();
        }
      }}
      role="link"
      tabIndex={0}
      className={`group flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer border h-[64px] ${
        isActive
          ? 'bg-brand-red/10 border-brand-red/20 text-brand-red shadow-[0_0_12px_var(--ns-accent-glow-soft)]'
          : 'bg-zinc-900/12 border-zinc-900/45 hover:bg-zinc-900/55 hover:border-zinc-800/65'
      }`}
    >
      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
        {/* Cover Art Thumbnail */}
        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-zinc-950 border border-zinc-900 shadow-md">
          <FallbackCover
            src={playlist.coverUrl}
            title={playlist.name}
            artistName={playlist.creator}
            genre="Playlist"
            className="w-full h-full"
            imageClassName="object-cover"
          />
          <button
            onClick={handlePlayClick}
            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Play Playlist"
            aria-label={`Play ${playlist.name}`}
          >
            <Play size={14} className="text-white fill-white" />
          </button>
        </div>

        {/* Text Metadata */}
        <div className="min-w-0 flex-1">
          <h5 className={`text-[14.5px] font-bold truncate tracking-tight leading-snug ${
            isActive ? 'text-brand-red' : 'text-zinc-300 group-hover:text-white'
          }`}>
            {playlist.name}
          </h5>
          <p className="text-[12.5px] text-zinc-400 truncate mt-0.5 font-medium">
            {playlist.createdByCurrentUser ? 'Playlist' : `by ${playlist.creator}`} • {playlist.trackCount ?? (playlist.trackIds || playlist.tracks || []).length} tracks
          </p>
        </div>
      </div>

      {/* Pin Indicator */}
      <button
        type="button"
        onClick={openFromButton}
        className="ns-icon-button !min-h-9 !min-w-9 shrink-0 text-zinc-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label={`More actions for ${playlist.name}`}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={14} />
      </button>
      {playlist.isPinned && (
        <span className="text-brand-red opacity-60 shrink-0 ml-2" title="Pinned Playlist">
          <Pin size={11} className="rotate-45" fill="currentColor" />
        </span>
      )}
    </div>
  );
}
