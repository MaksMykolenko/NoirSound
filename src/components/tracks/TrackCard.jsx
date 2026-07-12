import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Heart, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import FallbackCover from '../ui/FallbackCover';
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
      className="group cursor-pointer border border-zinc-800/60 bg-zinc-950/35 p-3 transition-colors duration-150 hover:border-zinc-700/70 hover:bg-zinc-900/45 rounded-lg"
    >
      {/* Cover image wrap */}
      <div className="relative mb-3 aspect-square overflow-hidden rounded-md border border-zinc-800/60 bg-zinc-950">
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
        <div className={`absolute inset-0 bg-black/55 flex items-center justify-center transition-opacity duration-150 ${
          isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          {canPlay ? (
          <button
            onClick={handlePlayClick}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-brand-red text-[var(--ns-on-accent)] transition-colors duration-150 hover:bg-rose-700"
            aria-label={isPlayingThis ? `Pause ${track.title}` : `Play ${track.title}`}
          >
            {isPlayingThis ? (
              <Pause size={20} fill="white" strokeWidth={0} />
            ) : (
              <Play size={20} className="translate-x-[1px]" fill="white" strokeWidth={0} />
            )}
          </button>
          ) : (
            <span className="rounded border border-zinc-600/70 bg-zinc-950/85 px-3 py-1.5 font-mono text-[9px] font-medium uppercase tracking-wider text-zinc-300">
              Audio unavailable
            </span>
          )}
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
      </div>

      {/* Track info details */}
      <div className="flex justify-between items-start px-1">
        <div className="min-w-0 flex-1">
          <h4 className={`truncate text-[13px] font-semibold ${
            isCurrent ? 'text-brand-red' : 'text-zinc-200 group-hover:text-zinc-100'
          }`}>
            {track.title}
          </h4>
          <span className="mt-0.5 flex items-baseline justify-between gap-2">
            <span
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/artist/${track.artistId}`);
              }}
              className="min-w-0 truncate font-mono text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {track.artistName}
            </span>
            <span className="shrink-0 font-mono text-[9px] text-zinc-600 select-none">
              {formatDuration(track.duration)}
            </span>
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
