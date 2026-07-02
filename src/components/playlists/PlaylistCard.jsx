import React from 'react';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../../store/playerStore';
import { formatNumber } from '../../utils/formatLocale';
import FallbackCover from '../ui/FallbackCover';

export default function PlaylistCard({ playlist }) {
  const { playTrack } = usePlayerStore();
  const navigate = useNavigate();

  const handlePlayClick = (e) => {
    e.stopPropagation();
    const tracksInPlaylist = playlist.tracks || [];
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
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/playlist/${playlist.id}`);
        }
      }}
      role="link"
      tabIndex={0}
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

        {/* Tracks count tag */}
        <div className="absolute bottom-2 left-2 text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-zinc-950/75 border border-zinc-900/40 text-zinc-200 backdrop-blur-sm select-none">
          {(playlist.trackIds || playlist.tracks || []).length} tracks
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
