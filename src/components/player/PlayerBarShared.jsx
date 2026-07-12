import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { formatTime } from '../../utils/formatTime';
import FallbackCover from '../ui/FallbackCover';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import { isMockMode } from '../../api/mode';
import { resolvePlaybackErrorMessage } from '../../utils/playbackErrorMessage';

export function PlaybackErrorStatus({ error, className = '' }) {
  const { t } = useTranslation();
  if (!error) return null;

  const message = resolvePlaybackErrorMessage(error, {
    mockMode: isMockMode(),
    demoMessage: t('player.demoAudioUnavailable'),
    unavailableMessage: t('player.audioUnavailable'),
  });

  return (
    <p
      className={`min-w-0 truncate text-ns-label font-medium text-rose-300 ${className}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      title={message === error ? undefined : String(error)}
    >
      {message}
    </p>
  );
}

export function PlayerTrackInfo({
  track,
  isLiked,
  onToggleLike,
  playbackError,
  className = 'w-[clamp(14rem,24vw,21rem)] min-w-0',
}) {
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);
  return (
    <div
      className={`flex items-center space-x-3 ${className}`}
      data-testid="standard-player-track-info"
      onContextMenu={contextMenuProps.onContextMenu}
      onKeyDown={contextMenuProps.onKeyDown}
      tabIndex={0}
    >
      <FallbackCover
        src={track.coverUrl}
        title={track.title}
        artistName={track.artistName}
        genre={track.genre}
        className="h-14 w-14 shrink-0 animate-fade-in rounded border border-[var(--ns-border-subtle)]"
        imageClassName="object-cover"
      />
      <div className="min-w-0 flex-1">
        <h4 className="text-ns-card-title font-bold text-zinc-100 truncate hover:underline cursor-pointer">
          {track.title}
        </h4>
        <p className="text-ns-label text-zinc-350 truncate hover:text-zinc-100 cursor-pointer font-medium">
          {track.artistName}
        </p>
        <PlaybackErrorStatus error={playbackError} />
      </div>
      <button
        type="button"
        onClick={onToggleLike}
        className={`p-2 transition-colors cursor-pointer shrink-0 focus:outline-none focus:text-brand-red ${
          isLiked ? 'text-brand-red' : 'text-zinc-500 hover:text-zinc-300'
        }`}
        title={isLiked ? 'Unlike' : 'Like'}
        aria-label={isLiked ? `Unlike ${track.title}` : `Like ${track.title}`}
        aria-pressed={isLiked}
      >
        <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={openFromButton}
        className="ns-icon-button !min-h-10 !min-w-10 shrink-0 text-zinc-500 hover:text-zinc-200"
        aria-label={`More actions for ${track.title}`}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}

export function PlayerTransportControls({
  isPlaying,
  shuffle,
  repeatMode,
  onTogglePlay,
  onPrevious,
  onNext,
  onToggleShuffle,
  onToggleRepeat,
}) {
  return (
    <div
      className="flex items-center space-x-5 mb-1.5 shrink-0"
      data-testid="standard-player-transport"
    >
      <button
        type="button"
        onClick={onToggleShuffle}
        className={`p-1 transition-colors cursor-pointer focus:outline-none focus:text-brand-red ${
          shuffle ? 'text-brand-red' : 'text-zinc-500 hover:text-zinc-300'
        }`}
        title="Shuffle"
        aria-label="Toggle shuffle"
        aria-pressed={shuffle}
      >
        <Shuffle size={16} />
      </button>
      <button
        type="button"
        onClick={onPrevious}
        className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer focus:outline-none focus:text-zinc-100"
        title="Previous"
        aria-label="Previous track"
      >
        <SkipBack size={18} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--ns-player-control-bg)] text-[var(--ns-player-control-text)] shadow-md transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-red"
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        data-testid="standard-player-play-button"
      >
        {isPlaying
          ? <Pause size={14} fill="currentColor" strokeWidth={0} />
          : <Play size={14} fill="currentColor" strokeWidth={0} className="translate-x-[0.5px]" />}
      </button>
      <button
        type="button"
        onClick={onNext}
        className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer focus:outline-none focus:text-zinc-100"
        title="Next"
        aria-label="Next track"
      >
        <SkipForward size={18} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={onToggleRepeat}
        className={`p-1 transition-colors cursor-pointer focus:outline-none focus:text-brand-red ${
          repeatMode !== 'none' ? 'text-brand-red' : 'text-zinc-500 hover:text-zinc-300'
        }`}
        title={`Repeat: ${repeatMode}`}
        aria-label={`Change repeat mode. Current mode: ${repeatMode}`}
      >
        <Repeat size={16} />
      </button>
    </div>
  );
}

export function PlayerProgress({ progress, duration, onSeek }) {
  return (
    <div
      className="w-full flex items-center space-x-2 text-ns-label text-zinc-450 font-sans tabular-nums select-none font-medium"
      data-testid="standard-player-progress"
    >
      <span className="w-8 text-right shrink-0">{formatTime(progress)}</span>
      <div className="flex-1 flex items-center relative">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={progress}
          onChange={(event) => onSeek(parseFloat(event.target.value))}
          className="premium-slider w-full"
          aria-label="Track progress"
          style={{ '--slider-progress': `${(progress / (duration || 100)) * 100}%` }}
        />
      </div>
      <span className="w-8 text-left shrink-0">{formatTime(duration)}</span>
    </div>
  );
}

export function PlayerVolumeControls({ volume, onSetVolume }) {
  const toggleMute = () => onSetVolume(volume > 0 ? 0 : 0.5);

  return (
    <div
      className="flex items-center space-x-2 group/vol max-w-[100px] md:max-w-none"
      data-testid="standard-player-volume"
    >
      <button
        type="button"
        onClick={toggleMute}
        className="text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer shrink-0 focus:outline-none focus:text-zinc-100"
        aria-label={volume === 0 ? 'Unmute' : 'Mute'}
      >
        {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <div className="w-16 md:w-20 flex items-center">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => onSetVolume(parseFloat(event.target.value))}
          className="premium-slider w-full"
          aria-label="Volume"
          style={{ '--slider-progress': `${volume * 100}%` }}
        />
      </div>
    </div>
  );
}

export function DesktopPlayerBarContent({
  track,
  isPlaying,
  volume,
  progress,
  duration,
  repeatMode,
  shuffle,
  isLiked,
  playbackError,
  lyricsAvailable,
  lyricsActive,
  isQueueOpen,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onSetVolume,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLike,
  onLyrics,
  onToggleQueue,
  onClose,
  closeLabel,
}) {
  const { t } = useTranslation();

  return (
    <>
      <PlayerTrackInfo
        track={track}
        isLiked={isLiked}
        onToggleLike={onToggleLike}
        playbackError={playbackError}
      />

      <div className="flex min-w-0 max-w-2xl flex-1 flex-col items-center px-3 xl:px-5">
        <PlayerTransportControls
          isPlaying={isPlaying}
          shuffle={shuffle}
          repeatMode={repeatMode}
          onTogglePlay={onTogglePlay}
          onPrevious={onPrevious}
          onNext={onNext}
          onToggleShuffle={onToggleShuffle}
          onToggleRepeat={onToggleRepeat}
        />
        <PlayerProgress progress={progress} duration={duration} onSeek={onSeek} />
      </div>

      <div
        className="flex w-[clamp(14rem,24vw,21rem)] min-w-0 items-center justify-end gap-2"
        data-testid="standard-player-actions"
      >
        <button
          type="button"
          onClick={onLyrics}
          disabled={!lyricsAvailable}
          className={`p-2 transition-all focus:outline-none ${
            lyricsAvailable
              ? lyricsActive
                ? 'rounded-md border border-brand-red/30 bg-zinc-900 text-brand-red'
                : 'text-zinc-500 hover:text-zinc-200 cursor-pointer'
              : 'text-zinc-700 cursor-not-allowed'
          }`}
          title={lyricsAvailable ? t('player.lyrics') : t('player.lyricsUnavailable')}
          aria-label={
            lyricsAvailable
              ? lyricsActive ? t('player.closeLyrics') : t('player.openLyrics')
              : t('player.lyricsUnavailable')
          }
          aria-pressed={lyricsActive}
        >
          <FileText size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleQueue}
          className={`p-2 transition-all cursor-pointer focus:outline-none focus:text-brand-red ${
            isQueueOpen
              ? 'rounded-md border border-[var(--ns-border)] bg-zinc-900 text-brand-red'
              : 'text-zinc-500 hover:text-zinc-200'
          }`}
          title="Open Queue"
          aria-label="Open play queue"
          aria-expanded={isQueueOpen}
        >
          <ListMusic size={18} />
        </button>
        <PlayerVolumeControls volume={volume} onSetVolume={onSetVolume} />
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer shrink-0 focus:outline-none focus:text-brand-red"
          title={closeLabel}
          aria-label={closeLabel}
        >
          <X size={18} />
        </button>
      </div>
    </>
  );
}

export function MobilePlayerProgress({ progress, duration, onSeek }) {
  return (
    <div className="space-y-2" data-testid="standard-mobile-player-progress">
      <div className="flex items-center relative">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={progress}
          onChange={(event) => onSeek(parseFloat(event.target.value))}
          className="premium-slider w-full"
          aria-label="Track progress"
          style={{ '--slider-progress': `${(progress / (duration || 100)) * 100}%` }}
        />
      </div>
      <div className="flex justify-between items-center text-ns-label text-zinc-400 font-sans tabular-nums font-medium">
        <span>{formatTime(progress)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

export function MobilePlayerTransportControls({
  isPlaying,
  shuffle,
  repeatMode,
  onTogglePlay,
  onPrevious,
  onNext,
  onToggleShuffle,
  onToggleRepeat,
}) {
  return (
    <div
      className="flex items-center justify-between px-4"
      data-testid="standard-mobile-player-transport"
    >
      <button
        type="button"
        onClick={onToggleShuffle}
        className={`p-2 transition-colors cursor-pointer focus:outline-none ${
          shuffle ? 'text-brand-red' : 'text-zinc-500'
        }`}
        aria-label="Toggle shuffle"
        aria-pressed={shuffle}
      >
        <Shuffle size={18} />
      </button>
      <button
        type="button"
        onClick={onPrevious}
        className="p-2 text-zinc-300 active:text-zinc-100 transition-colors cursor-pointer focus:outline-none"
        aria-label="Previous track"
      >
        <SkipBack size={22} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-[var(--ns-player-control-bg)] text-[var(--ns-player-control-text)] shadow-md transition-colors active:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-red"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        data-testid="standard-mobile-player-play-button"
      >
        {isPlaying
          ? <Pause size={24} fill="currentColor" strokeWidth={0} />
          : <Play size={24} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />}
      </button>
      <button
        type="button"
        onClick={onNext}
        className="p-2 text-zinc-300 active:text-zinc-100 transition-colors cursor-pointer focus:outline-none"
        aria-label="Next track"
      >
        <SkipForward size={22} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={onToggleRepeat}
        className={`p-2 transition-colors cursor-pointer focus:outline-none ${
          repeatMode !== 'none' ? 'text-brand-red' : 'text-zinc-500'
        }`}
        aria-label={`Change repeat mode. Current mode: ${repeatMode}`}
      >
        <Repeat size={18} />
      </button>
    </div>
  );
}
