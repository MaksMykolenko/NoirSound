import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Pause, Heart, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import { getLocalizedGenre } from '../../i18n/genreLabels';
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

  return (
    <div
      onContextMenu={contextMenuProps.onContextMenu}
      data-track-id={track.id}
      className="ns-media-card group"
    >
      <Link
        to={`/track/${track.id}`}
        onKeyDown={contextMenuProps.onKeyDown}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`Open ${track.title} by ${track.artistName}`}
      />
      <div className="pointer-events-none relative z-[1]">
      {/* Cover image wrap */}
      <div className="ns-media-card__artwork relative mb-3 aspect-square">
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
        <div className={`absolute inset-0 flex items-center justify-center bg-black/55 transition-opacity duration-150 ${
          isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        }`}>
          {canPlay ? (
          <button
            onClick={handlePlayClick}
            className="pointer-events-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-brand-red text-[var(--ns-on-accent)] transition-colors duration-150 hover:bg-rose-700"
            aria-label={isPlayingThis ? `Pause ${track.title}` : `Play ${track.title}`}
          >
            {isPlayingThis ? (
              <Pause size={20} fill="white" strokeWidth={0} />
            ) : (
              <Play size={20} className="translate-x-[1px]" fill="white" strokeWidth={0} />
            )}
          </button>
          ) : (
            <span className="rounded border border-zinc-600/70 bg-zinc-950/85 px-3 py-1.5 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-300">
              Audio unavailable
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={openFromButton}
          className="pointer-events-auto absolute right-2 top-2 z-10 ns-icon-button !min-h-9 !min-w-9 bg-zinc-950/85 text-zinc-300 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus:opacity-100"
          aria-label={`More actions for ${track.title}`}
          aria-haspopup="menu"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>

      {/* Track info details */}
      <div className="flex justify-between items-start px-1">
        <div className="min-w-0 flex-1">
          <h4 className={`truncate text-ns-body-sm font-semibold ${
            isCurrent ? 'text-brand-red' : 'text-zinc-200 group-hover:text-zinc-100'
          }`}>
            {track.title}
          </h4>
          <span className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/artist/${track.artistId}`);
                }}
                className="pointer-events-auto relative z-10 min-w-0 truncate text-left font-sans tabular-nums text-ns-meta text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {track.artistName}
              </button>
              {track.genre && (
                <span className="hidden shrink-0 font-sans text-ns-meta text-zinc-600 sm:inline">
                  <span aria-hidden="true">· </span>
                  <span>{getLocalizedGenre(track.genre)}</span>
                </span>
              )}
            </span>
            <span className="shrink-0 font-sans tabular-nums text-ns-meta text-zinc-600 select-none">
              {formatDuration(track.duration)}
            </span>
          </span>
        </div>

        <button
          onClick={handleLikeClick}
          className={`pointer-events-auto relative z-10 ns-icon-button !min-h-10 !min-w-10 shrink-0 transition-colors cursor-pointer ${
            isLiked ? 'text-brand-red' : 'text-zinc-600 hover:text-zinc-300'
          }`}
          aria-label={isLiked ? `Unlike ${track.title}` : `Like ${track.title}`}
          aria-pressed={isLiked}
        >
          <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
        </button>
      </div>
      </div>
    </div>
  );
}
