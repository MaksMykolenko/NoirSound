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
      className="group cursor-pointer rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-3 transition-colors duration-150 hover:border-zinc-700/70 hover:bg-zinc-900/45"
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
      <div className="relative mb-3 aspect-square overflow-hidden rounded-md border border-zinc-800/60 bg-zinc-950">
        <FallbackCover
          src={playlist.coverUrl}
          title={playlist.name}
          artistName={playlist.creator}
          genre="Playlist"
          className="w-full h-full"
          imageClassName="object-cover"
          loading="lazy"
        />

        {/* Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            onClick={handlePlayClick}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-brand-red text-[var(--ns-on-accent)] transition-colors duration-150 hover:bg-rose-700"
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
        <div className="absolute bottom-2 left-2 rounded border border-zinc-800/60 bg-zinc-950/85 px-2 py-0.5 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-300 select-none">
          {playlist.trackCount ?? (playlist.trackIds || playlist.tracks || []).length} tracks
        </div>
      </div>

      {/* Playlist info */}
      <div className="px-1 space-y-1">
        <h4 className="truncate text-ns-body-sm font-semibold text-zinc-200">
          {playlist.name}
        </h4>
        <p className="truncate text-ns-label text-zinc-500">{playlist.description}</p>
        <div className="flex items-center justify-between border-t border-zinc-800/50 pt-1 font-sans tabular-nums text-ns-meta text-zinc-500">
          <span>By {playlist.creator}</span>
          <span className="font-sans tabular-nums">{formatNumber(playlist.likes || 0)} likes</span>
        </div>
      </div>
    </div>
  );
}
