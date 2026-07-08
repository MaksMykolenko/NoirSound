import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Heart, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import FallbackCover from '../ui/FallbackCover';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';

export default function TrackCard({ track, tracksContext = [] }) {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTracks, toggleLikeTrack } = usePlayerStore();

  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = likedTracks.includes(track.id);
  const canPlay = track.isStreamable ?? Boolean(track.audioUrl);
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (!canPlay) return;
    if (isCurrent) {
      togglePlay();
    } else {
      // Pass the surrounding tracks list as the queue context
      const queueList = tracksContext.length > 0 ? tracksContext : [track];
      playTrack(track, queueList);
    }
  };

  const handleLikeClick = (e) => {
    e.stopPropagation();
    toggleLikeTrack(track.id);
  };

  const handleCardClick = () => {
    navigate(`/track/${track.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={(event) => {
        contextMenuProps.onKeyDown(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleCardClick();
        }
      }}
      onContextMenu={contextMenuProps.onContextMenu}
      role="link"
      tabIndex={0}
      aria-label={`Open ${track.title} by ${track.artistName}`}
      data-track-id={track.id}
      className="p-3 ns-card ns-card-interactive cursor-pointer group"
    >
      {/* Cover image wrap */}
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3.5 bg-zinc-950 border border-zinc-900/60 shadow-md">
        <FallbackCover
          src={track.coverUrl}
          title={track.title}
          artistName={track.artistName}
          genre={track.genre}
          className="w-full h-full"
          imageClassName="object-cover"
          loading="lazy"
        />

        {/* Hover/Active Play Overlay */}
        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${
          isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          {canPlay ? (
          <button
            onClick={handlePlayClick}
            className="w-12 h-12 bg-brand-red text-[var(--ns-on-accent)] rounded-full flex items-center justify-center shadow-[0_0_18px_var(--ns-accent-glow)] transform scale-90 group-hover:scale-100 transition-all duration-200 cursor-pointer"
            aria-label={isPlayingThis ? `Pause ${track.title}` : `Play ${track.title}`}
          >
            {isPlayingThis ? (
              <Pause size={20} fill="white" strokeWidth={0} />
            ) : (
              <Play size={20} className="translate-x-[1px]" fill="white" strokeWidth={0} />
            )}
          </button>
          ) : (
            <span className="px-3 py-1.5 rounded-full border border-zinc-600/70 bg-zinc-950/85 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
              Audio unavailable
            </span>
          )}
        </div>

        {/* Top small tags */}
        <div className="absolute top-2 left-2 right-2 flex items-center space-x-1">
          <span className="max-w-full truncate text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-zinc-950/90 border border-zinc-800/70 text-rose-300 backdrop-blur-sm select-none">
            {getLocalizedGenre(track.genre)}
          </span>
        </div>
        <button
          type="button"
          onClick={openFromButton}
          className="absolute right-2 top-2 z-10 ns-icon-button !min-h-9 !min-w-9 bg-zinc-950/85 text-zinc-300 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
          aria-label={`More actions for ${track.title}`}
          aria-haspopup="menu"
        >
          <MoreHorizontal size={15} />
        </button>

        {/* Duration Overlay Bottom Right */}
        <div className="absolute bottom-2 right-2 text-[11.5px] font-bold font-mono px-1.5 py-0.5 rounded bg-zinc-950/75 border border-zinc-900/40 text-zinc-200 backdrop-blur-sm select-none">
          {formatDuration(track.duration)}
        </div>
      </div>

      {/* Track info details */}
      <div className="flex justify-between items-start px-1">
        <div className="min-w-0 flex-1">
          <h4 className={`text-[15px] font-bold truncate ${
            isCurrent ? 'text-brand-red' : 'text-zinc-200 group-hover:text-zinc-100'
          }`}>
            {track.title}
          </h4>
          <span
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/artist/${track.artistId}`);
            }}
            className="text-[13px] text-zinc-400 hover:text-zinc-200 transition-colors truncate block mt-0.5"
          >
            {track.artistName}
          </span>
        </div>

        <button
          onClick={handleLikeClick}
          className={`ns-icon-button !min-h-10 !min-w-10 shrink-0 transition-colors cursor-pointer ${
            isLiked ? 'text-brand-red' : 'text-zinc-600 hover:text-zinc-300'
          }`}
          aria-label={isLiked ? `Unlike ${track.title}` : `Like ${track.title}`}
          aria-pressed={isLiked}
        >
          <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}
