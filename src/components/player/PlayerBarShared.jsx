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
} from 'lucide-react';
import { formatTime } from '../../utils/formatTime';
import FallbackCover from '../ui/FallbackCover';

export function PlayerTrackInfo({
  track,
  isLiked,
  onToggleLike,
  playbackError,
  className = 'w-1/4 min-w-[180px]',
}) {
  return (
    <div
      className={`flex items-center space-x-3 ${className}`}
      data-testid="standard-player-track-info"
    >
      <FallbackCover
        src={track.coverUrl}
        title={track.title}
        artistName={track.artistName}
        genre={track.genre}
        className="w-14 h-14 rounded-lg border border-zinc-800 shadow-[0_0_10px_rgba(0,0,0,0.5)] shrink-0 animate-fade-in"
        imageClassName="object-cover"
      />
      <div className="min-w-0 flex-1">
        <h4 className="text-[15px] font-bold text-zinc-100 truncate hover:underline cursor-pointer">
          {track.title}
        </h4>
        <p className="text-[13px] text-zinc-350 truncate hover:text-zinc-100 cursor-pointer font-medium">
          {track.artistName}
        </p>
        {playbackError && (
          <p className="text-[11px] text-rose-300 truncate" role="alert">{playbackError}</p>
        )}
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
        className="w-8 h-8 rounded-full bg-[var(--ns-player-control-bg)] text-[var(--ns-player-control-text)] flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-md focus:outline-none focus:ring-2 focus:ring-brand-red"
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
      className="w-full flex items-center space-x-2 text-[12px] text-zinc-450 font-mono select-none font-medium"
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

      <div className="flex flex-col items-center flex-1 max-w-2xl px-4 min-w-0">
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
        className="flex items-center justify-end space-x-3 w-1/4 min-w-[150px]"
        data-testid="standard-player-actions"
      >
        <button
          type="button"
          onClick={onLyrics}
          disabled={!lyricsAvailable}
          className={`p-2 transition-all focus:outline-none ${
            lyricsAvailable
              ? lyricsActive
                ? 'text-brand-red bg-zinc-900 border border-brand-red/30 rounded-xl'
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
              ? 'text-brand-red bg-zinc-900 border border-zinc-800/80 rounded-xl shadow-[0_0_12px_var(--ns-accent-glow-soft)]'
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
      <div className="flex justify-between items-center text-[12px] text-zinc-400 font-mono font-medium">
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
        className="w-16 h-16 rounded-full bg-[var(--ns-player-control-bg)] text-[var(--ns-player-control-text)] flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-red"
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
