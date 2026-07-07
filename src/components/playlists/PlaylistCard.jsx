import React from 'react';
import { MoreHorizontal, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../../store/playerStore';
import { formatNumber } from '../../utils/formatLocale';
import FallbackCover from '../ui/FallbackCover';
import { usePlaylistContextMenu } from '../../hooks/useEntityContextMenu';
import { getPlaylistById } from '../../api/playlists';

export default function PlaylistCard({ playlist, onToggleSaved, onEdit, onDelete }) {
  const { playTrack } = usePlayerStore();
  const navigate = useNavigate();
  const { contextMenuProps, openFromButton } = usePlaylistContextMenu(playlist, {
    onToggleSaved,
    onEdit,
    onDelete,
  });

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
      // Play the first track and load the rest as the queue context
      playTrack(tracksInPlaylist[0], tracksInPlaylist);
    }
  };

  return (
    <div
      className="p-3 ns-card ns-card-interactive cursor-pointer group"
      onClick={() => navigate(`/playlist/${playlist.id}`)}
      onKeyDown={(event) => {
        contextMenuProps.onKeyDown(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/playlist/${playlist.id}`);
        }
      }}
      onContextMenu={contextMenuProps.onContextMenu}
      role="link"
      tabIndex={0}
      data-playlist-id={playlist.id}
      aria-label={`Open playlist ${playlist.name}`}
    >
      {/* Cover wrapped */}
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-zinc-950 border border-zinc-900/60 shadow-md">
        <FallbackCover
          src={playlist.coverUrl}
          title={playlist.name}
          artistName={playlist.creator}
          genre="Playlist"
          className="w-full h-full group-hover:scale-105 transition-transform duration-500"
          imageClassName="object-cover"
          loading="lazy"
        />

        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={handlePlayClick}
            className="w-12 h-12 bg-brand-red text-[var(--ns-on-accent)] rounded-full flex items-center justify-center shadow-[0_0_15px_var(--ns-accent-glow)] transform scale-90 group-hover:scale-100 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
            aria-label={`Play ${playlist.name}`}
          >
            <Play size={20} className="translate-x-[1px]" fill="white" strokeWidth={0} />
          </button>
        </div>
        <button
          type="button"
          onClick={openFromButton}
          className="absolute right-2 top-2 z-10 ns-icon-button !min-h-9 !min-w-9 bg-zinc-950/85 text-zinc-300 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
          aria-label={`More actions for ${playlist.name}`}
          aria-haspopup="menu"
        >
          <MoreHorizontal size={15} />
        </button>

        {/* Tracks count tag */}
        <div className="absolute bottom-2 left-2 text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-zinc-950/75 border border-zinc-900/40 text-zinc-200 backdrop-blur-sm select-none">
          {playlist.trackCount ?? (playlist.trackIds || playlist.tracks || []).length} tracks
        </div>
      </div>

      {/* Playlist info */}
      <div className="px-1 space-y-1">
        <h4 className="text-[15px] font-bold text-zinc-200 group-hover:text-zinc-100 truncate">
          {playlist.name}
        </h4>
        <p className="text-[13px] text-zinc-400 truncate">{playlist.description}</p>
        <div className="flex justify-between items-center text-[12px] text-zinc-550 font-medium pt-1 border-t border-zinc-900/40">
          <span>By {playlist.creator}</span>
          <span className="font-mono">{formatNumber(playlist.likes || 0)} likes</span>
        </div>
      </div>
    </div>
  );
}
