import { playerTrackHref } from '../../utils/playerTrackPresentation';
import { TrackSaveIcon } from '../tracks/TrackVisuals';
import TrackSourceIcon from '../tracks/TrackSourceIcon';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Maximize2,
  Minimize2,
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
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Icon control shared by the desktop and mobile players: shadcn Button for a
// visible focus ring and a themed hover surface, plus a tooltip in place of
// the native title attribute.
export function PlayerIconButton({ label, tooltip = label, active = false, className, children, ...props }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn(
            'rounded-full text-zinc-400 hover:bg-[var(--ns-hover-bg)] hover:text-zinc-100',
            active && 'text-brand-red hover:text-brand-red',
            className,
          )}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}


export function PlaybackErrorStatus({ error, className = '' }) {
  const { t } = useTranslation();
  if (!error) return null;

  const key='playlistImport.playbackErrors.'+error;
  const message = t(key,{defaultValue:''}) || resolvePlaybackErrorMessage(error, {
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
      title={message}
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
  onOpenTrack,
  className = 'w-[clamp(14rem,24vw,21rem)] min-w-0',
}) {
  const { t } = useTranslation();
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);
  return (
    <div
      key={track?.id}
      className={`ns-player-track-info ns-player-track-fade flex items-center ${className}`}
      data-testid="standard-player-track-info"
      onContextMenu={contextMenuProps.onContextMenu}
      onKeyDown={contextMenuProps.onKeyDown}
    >
      <FallbackCover
        src={track?.coverUrl}
        title={track?.title}
        artistName={track?.artistName}
        genre={track?.genre}
        className="h-14 w-14 shrink-0 animate-fade-in rounded border border-[var(--ns-border-subtle)]"
        imageClassName="object-cover"
      />
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-medium text-zinc-100">
          <Link
            title={track.title}
            to={playerTrackHref(track)}
            onClick={onOpenTrack}
            className="block truncate hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {track.title}
          </Link>
        </h4>
        {(track.playbackSource === 'external' || track.importedPlaylistId) ? <span className="block truncate text-xs text-zinc-400">{track.artistName}</span> : <Link to={`/artist/${track.artistId}`} onClick={onOpenTrack} title={track.artistName} className="block text-xs text-zinc-400 truncate hover:text-zinc-100">{track.artistName}</Link>}
        <TrackSourceIcon track={track} />
        <PlaybackErrorStatus error={playbackError} />
      </div>
      <PlayerIconButton
        disabled={Boolean(track.previewExternalId || track.importedPlaylistId)}
        onClick={onToggleLike}
        className="shrink-0"
        active={isLiked}
        tooltip={t(isLiked ? 'trackPage.unlike' : 'trackPage.like')}
        label={t(isLiked ? 'player.unlikeTrack' : 'player.likeTrack', { title: track.title })}
        aria-pressed={isLiked}
      >
        <TrackSaveIcon saved={isLiked} />
      </PlayerIconButton>
      <PlayerIconButton
        disabled={Boolean(track.importedPlaylistId)}
        onClick={openFromButton}
        className="shrink-0"
        label={t('playlists.moreActionsFor', { title: track.title })}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={16} />
      </PlayerIconButton>
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
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-3 mb-1 shrink-0"
      data-testid="standard-player-transport"
    >
      <PlayerIconButton
        onClick={onToggleShuffle}
        active={shuffle}
        tooltip={t('playlists.shuffle')}
        label={t('player.toggleShuffle')}
        aria-pressed={shuffle}
      >
        <Shuffle size={16} />
      </PlayerIconButton>
      <PlayerIconButton onClick={onPrevious} label={t('player.previousTrack')}>
        <SkipBack size={18} fill="currentColor" />
      </PlayerIconButton>
      <PlayerIconButton
        onClick={onTogglePlay}
        label={isPlaying ? t('contextMenu.pause') : t('contextMenu.play')}
        data-testid="standard-player-play-button"
        className="size-9 bg-[var(--ns-player-control-bg)] text-[var(--ns-player-control-text)] shadow-md hover:bg-[var(--ns-player-control-bg)] hover:text-[var(--ns-player-control-text)] hover:opacity-90"
      >
        {isPlaying
          ? <Pause size={14} fill="currentColor" strokeWidth={0} />
          : <Play size={14} fill="currentColor" strokeWidth={0} className="translate-x-[0.5px]" />}
      </PlayerIconButton>
      <PlayerIconButton onClick={onNext} label={t('player.nextTrack')}>
        <SkipForward size={18} fill="currentColor" />
      </PlayerIconButton>
      <PlayerIconButton
        onClick={onToggleRepeat}
        active={repeatMode !== 'none'}
        tooltip={t('player.repeatTitle', { mode: t(`player.repeatModes.${repeatMode}`) })}
        label={t('player.changeRepeatMode', { mode: t(`player.repeatModes.${repeatMode}`) })}
      >
        <Repeat size={16} />
      </PlayerIconButton>
    </div>
  );
}

export function PlayerProgress({ progress, duration, onSeek }) {
  const { t } = useTranslation();
  return (
    <div
      className="w-full flex items-center space-x-2 text-ns-label text-zinc-450 font-sans tabular-nums select-none font-medium"
      data-testid="standard-player-progress"
    >
      <span className="min-w-[4ch] text-right shrink-0">{formatTime(progress)}</span>
      <div className="flex-1 flex items-center relative">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={progress}
          onChange={(event) => onSeek(parseFloat(event.target.value))}
          className="premium-slider w-full"
          aria-label={t('player.trackProgress')}
          style={{ '--slider-progress': `${(progress / (duration || 100)) * 100}%` }}
        />
      </div>
      <span className="min-w-[4ch] text-left shrink-0">{formatTime(duration)}</span>
    </div>
  );
}

export function PlayerVolumeControls({ volume, onSetVolume }) {
  const { t } = useTranslation();
  const toggleMute = () => onSetVolume(volume > 0 ? 0 : 0.5);

  return (
    <div
      className="flex items-center space-x-2 group/vol max-w-[100px] md:max-w-none"
      data-testid="standard-player-volume"
    >
      <PlayerIconButton
        onClick={toggleMute}
        className="shrink-0"
        label={volume === 0 ? t('player.unmute') : t('player.mute')}
      >
        {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </PlayerIconButton>
      <div className="w-16 md:w-20 flex items-center">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => onSetVolume(parseFloat(event.target.value))}
          className="premium-slider w-full"
          aria-label={t('player.volume')}
          style={{ '--slider-progress': `${volume * 100}%` }}
        />
      </div>
    </div>
  );
}

export function DesktopPlayerBarContent({
  track,
  showTrackInfo = true,
  isPlaying,
  volume,
  progress,
  duration,
  repeatMode,
  shuffle,
  isLiked,
  playbackError,
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
  onOpenTrack,
}) {
  const { t } = useTranslation();

  return (
    <>
      {showTrackInfo && (
        <PlayerTrackInfo
          track={track}
          isLiked={isLiked}
          onToggleLike={onToggleLike}
          playbackError={playbackError}
          onOpenTrack={onOpenTrack}
        />
      )}

      <div className="flex min-w-0 max-w-2xl flex-1 flex-col items-center px-3 xl:px-5" data-testid="standard-player-playback">
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
        <PlayerIconButton
          onClick={onLyrics}
          data-testid="standard-player-fullscreen-button"
          className="size-10"
          label={t(lyricsActive ? 'player.closeLyrics' : 'player.openLyrics')}
          aria-pressed={lyricsActive}
        >
          {lyricsActive ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </PlayerIconButton>
        <PlayerIconButton
          onClick={onToggleQueue}
          active={isQueueOpen}
          className={isQueueOpen ? 'bg-[var(--ns-hover-bg)]' : undefined}
          label={t('player.openQueue')}
          aria-expanded={isQueueOpen}
        >
          <ListMusic size={18} />
        </PlayerIconButton>
        <PlayerVolumeControls volume={volume} onSetVolume={onSetVolume} />
        <PlayerIconButton onClick={onClose} className="shrink-0" label={closeLabel}>
          <X size={18} />
        </PlayerIconButton>
      </div>
    </>
  );
}

export function MobilePlayerProgress({ progress, duration, onSeek }) {
  const { t } = useTranslation();
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
          aria-label={t('player.trackProgress')}
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
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center justify-between px-4"
      data-testid="standard-mobile-player-transport"
    >
      <PlayerIconButton
        onClick={onToggleShuffle}
        active={shuffle}
        className="size-11"
        label={t('player.toggleShuffle')}
        aria-pressed={shuffle}
      >
        <Shuffle size={18} />
      </PlayerIconButton>
      <PlayerIconButton onClick={onPrevious} className="size-11 text-zinc-300" label={t('player.previousTrack')}>
        <SkipBack size={22} fill="currentColor" />
      </PlayerIconButton>
      <PlayerIconButton
        onClick={onTogglePlay}
        label={isPlaying ? t('contextMenu.pause') : t('contextMenu.play')}
        data-testid="standard-mobile-player-play-button"
        className="size-16 bg-[var(--ns-player-control-bg)] text-[var(--ns-player-control-text)] shadow-md hover:bg-[var(--ns-player-control-bg)] hover:text-[var(--ns-player-control-text)] active:opacity-85"
      >
        {isPlaying
          ? <Pause size={24} fill="currentColor" strokeWidth={0} />
          : <Play size={24} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />}
      </PlayerIconButton>
      <PlayerIconButton onClick={onNext} className="size-11 text-zinc-300" label={t('player.nextTrack')}>
        <SkipForward size={22} fill="currentColor" />
      </PlayerIconButton>
      <PlayerIconButton
        onClick={onToggleRepeat}
        active={repeatMode !== 'none'}
        className="size-11"
        label={t('player.changeRepeatMode', { mode: t(`player.repeatModes.${repeatMode}`) })}
      >
        <Repeat size={18} />
      </PlayerIconButton>
    </div>
  );
}
