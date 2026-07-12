import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Heart, Plus, Check, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import { formatNumber } from '../../utils/formatLocale';
import FallbackCover from '../ui/FallbackCover';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';

export default function TrackListItem({
  track,
  index,
  tracksContext = [],
  onRemoveFromPlaylist,
  queueSource = null,
}) {
  const navigate = useNavigate();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    likedTracks,
    toggleLikeTrack,
    queue,
    addToQueue,
    removeFromQueue
  } = usePlayerStore();

  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = likedTracks.includes(track.id);
  const inQueue = queue.some(t => t.id === track.id);
  const canPlay = track.isStreamable ?? Boolean(track.audioUrl);
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track, {
    removeFromPlaylist: onRemoveFromPlaylist
      ? () => onRemoveFromPlaylist(track)
      : undefined,
  });

  const handlePlay = (e) => {
    e.stopPropagation();
    if (!canPlay) return;
    if (isCurrent) {
      togglePlay();
    } else {
      const queueList = tracksContext.length > 0 ? tracksContext : [track];
      playTrack(track, queueList, queueSource);
    }
  };

  const handleLike = (e) => {
    e.stopPropagation();
    toggleLikeTrack(track.id);
  };

  const handleQueue = (e) => {
    e.stopPropagation();
    if (inQueue) {
      removeFromQueue(track.id);
    } else {
      addToQueue(track);
    }
  };

  return (
    <div
      onClick={() => navigate(`/track/${track.id}`)}
      onKeyDown={(event) => {
        contextMenuProps.onKeyDown(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/track/${track.id}`);
        }
      }}
      onContextMenu={contextMenuProps.onContextMenu}
      role="link"
      tabIndex={0}
      data-track-id={track.id}
      aria-label={`Open ${track.title} by ${track.artistName}`}
      className={`group flex min-h-14 cursor-pointer items-center justify-between rounded-md border p-2 transition-colors duration-150 ${
        isCurrent
          ? 'border-brand-red/30 bg-brand-red/5'
          : 'border-transparent bg-transparent hover:border-zinc-800/50 hover:bg-zinc-900/45'
      }`}
    >
      {/* Left section: Number, Cover, Title */}
      <div className="flex items-center space-x-2.5 sm:space-x-4 flex-1 min-w-0">
        {/* Play/Index toggle */}
        <div className="w-6 flex items-center justify-center shrink-0">
          <span className="select-none font-mono text-sm font-medium text-zinc-500 group-hover:hidden">
            {isCurrent && isPlaying ? (
              <span className="flex items-end justify-center space-x-[2px] h-3 w-3 pb-[1px]">
                <span className="w-[2px] h-full bg-brand-red animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-[2px] h-[75%] bg-brand-red animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                <span className="w-[2px] h-[50%] bg-brand-red animate-bounce" style={{ animationDelay: '0.5s' }}></span>
              </span>
            ) : (
              index + 1
            )}
          </span>
          {canPlay && (
          <button
            onClick={handlePlay}
            className="hidden group-hover:flex items-center justify-center text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
            aria-label={isPlayingThis ? `Pause ${track.title}` : `Play ${track.title}`}
          >
            {isPlayingThis ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
          )}
        </div>

        {/* Cover image thumb */}
        <FallbackCover
          src={track.coverUrl}
          title={track.title}
          artistName={track.artistName}
          genre={track.genre}
          className="h-10 w-10 shrink-0 rounded border border-zinc-800/60"
          imageClassName="object-cover"
        />

        {/* Metadata */}
        <div className="min-w-0 flex-1">
          <h4 className={`truncate text-[13px] font-semibold ${
            isCurrent ? 'text-brand-red' : 'text-zinc-200'
          }`}>
            {track.title}
          </h4>
          <span
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/artist/${track.artistId}`);
            }}
            className="mt-0.5 block truncate font-mono text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {track.artistName}
          </span>
          {!canPlay && (
            <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-amber-300/80">
              Audio unavailable
            </span>
          )}
        </div>
      </div>

      {/* Middle section: Genre, Plays count */}
      <div className="hidden min-[430px]:flex items-center space-x-3 sm:space-x-6 px-2 sm:px-4 shrink-0">
        <span className="hidden max-w-[14ch] truncate rounded border border-zinc-800/70 bg-zinc-800/40 px-2 py-0.5 align-middle font-mono text-[9px] font-medium uppercase tracking-wider text-zinc-400 select-none md:inline-block">
          {getLocalizedGenre(track.genre)}
        </span>
        <span className="hidden font-mono text-[10px] text-zinc-500 select-none sm:inline">
          {formatNumber(track.plays || 0)} plays
        </span>
        <span className="w-10 text-right font-mono text-[10px] text-zinc-500 select-none">
          {formatDuration(track.duration)}
        </span>
      </div>

      {/* Right section: Hover Action buttons */}
      <div className="flex items-center space-x-1.5 ml-4 shrink-0">
        <button
          type="button"
          onClick={openFromButton}
          className="ns-icon-button !min-h-10 !min-w-10 rounded-lg text-zinc-500 hover:text-zinc-200 md:opacity-0 md:group-hover:opacity-100"
          aria-label={`More actions for ${track.title}`}
          aria-haspopup="menu"
        >
          <MoreHorizontal size={15} />
        </button>
        {/* Like */}
        <button
          onClick={handleLike}
          className={`ns-icon-button !min-h-10 !min-w-10 rounded-lg transition-colors cursor-pointer ${
            isLiked
              ? 'text-brand-red bg-rose-500/10 border border-rose-500/20'
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 md:opacity-0 md:group-hover:opacity-100'
          }`}
          title={isLiked ? "Unlike Track" : "Like Track"}
          aria-label={isLiked ? `Unlike ${track.title}` : `Like ${track.title}`}
          aria-pressed={isLiked}
        >
          <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} />
        </button>

        {/* Queue */}
        {canPlay && (
        <button
          onClick={handleQueue}
          className={`ns-icon-button !min-h-10 !min-w-10 hidden cursor-pointer rounded transition-colors sm:inline-flex ${
            inQueue
              ? 'text-brand-red bg-zinc-900 border border-zinc-800'
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 md:opacity-0 md:group-hover:opacity-100'
          }`}
          title={inQueue ? "Remove from Queue" : "Add to Queue"}
          aria-label={inQueue ? `Remove ${track.title} from queue` : `Add ${track.title} to queue`}
          aria-pressed={inQueue}
        >
          {inQueue ? <Check size={12} /> : <Plus size={12} />}
        </button>
        )}
      </div>
    </div>
  );
}
