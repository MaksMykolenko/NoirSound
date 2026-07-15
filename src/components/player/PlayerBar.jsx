import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePlayerStore } from '../../store/playerStore';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ListMusic,
  Heart,
  X,
  Music,
  ChevronDown,
  FileText,
  MoreHorizontal
} from 'lucide-react';
import FallbackCover from '../ui/FallbackCover';
import {
  DesktopPlayerBarContent,
  MobilePlayerProgress,
  MobilePlayerTransportControls,
  PlaybackErrorStatus,
} from './PlayerBarShared';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';

export default function PlayerBar({ onToggleQueue, isQueueOpen }) {
  const { t } = useTranslation();
  const {
    currentTrack,
    isPlaying,
    volume,
    progress,
    duration,
    repeatMode,
    shuffle,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    likedTracks,
    toggleLikeTrack,
    playbackError,
    isPlayerCollapsed,
    lyricsFullscreenOpen,
    openLyricsFullscreen,
    collapsePlayer,
    expandPlayer
  } = usePlayerStore();

  const isLiked = currentTrack ? likedTracks.includes(currentTrack.id) : false;
  const lyricsAvailable = Boolean(currentTrack?.hasLyrics);
  const { contextMenuProps: trackContextMenuProps, openFromButton: openTrackActions } =
    useTrackContextMenu(currentTrack);
  const desktopPlayerHeight = 'h-[var(--ns-player-height)]';
  const desktopHiddenPosition = 'bottom-[calc(var(--ns-player-height)*-1)]';
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 1023px)').matches
  ));
  const mobileSheetOpen = Boolean(
    isMobileViewport && currentTrack && !isPlayerCollapsed && !lyricsFullscreenOpen && !isQueueOpen
  );
  const mobileSheetRef = useDialogFocusTrap(mobileSheetOpen, collapsePlayer);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 1023px)');
    const updateViewport = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(query.matches);
    query.addEventListener?.('change', updateViewport);
    return () => query.removeEventListener?.('change', updateViewport);
  }, []);

  const handleVolumeChange = (e) => {
    setVolume(parseFloat(e.target.value));
  };

  const toggleMute = () => {
    setVolume(volume > 0 ? 0 : 0.5);
  };

  // Keyboard shortcut: Escape key collapses player
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && !lyricsFullscreenOpen && !isPlayerCollapsed) {
        collapsePlayer();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isPlayerCollapsed, collapsePlayer, lyricsFullscreenOpen]);

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP PLAYBACK CONTROLLERS (lg:flex)                                 */}
      {/* ========================================================================= */}

      {/* Desktop Collapsed Floating Trigger */}
      {isPlayerCollapsed && (
        <div className="hidden lg:block select-none">
          {currentTrack ? (
            <div
              onClick={() => expandPlayer()}
              role="group"
              className="fixed bottom-6 right-8 z-[var(--ns-z-dropdown)] flex h-14 max-w-[320px] animate-fade-in cursor-pointer items-center gap-3.5 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] p-2 text-xs shadow-2xl transition-colors hover:bg-surface-hover focus:outline-none focus:ring-1 focus:ring-brand-red"
              aria-label="Collapsed player"
            >
              <FallbackCover
                src={currentTrack.coverUrl}
                title={currentTrack.title}
                artistName={currentTrack.artistName}
                genre={currentTrack.genre}
                className="w-10 h-10 rounded-lg border border-zinc-900 shrink-0"
                imageClassName="object-cover"
              />
              <div className="min-w-0 flex-1">
                <h5 className="truncate text-ns-body-sm font-bold leading-snug text-zinc-200">
                  <Link
                    to={`/track/${currentTrack.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {currentTrack.title}
                  </Link>
                </h5>
                <p className="text-ns-label text-zinc-400 truncate mt-0.5 font-medium">{currentTrack.artistName}</p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                {lyricsAvailable && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openLyricsFullscreen();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--ns-border-subtle)] bg-zinc-900 text-zinc-300 hover:text-brand-red"
                    aria-label={t('player.openLyrics')}
                    aria-pressed={lyricsFullscreenOpen}
                  >
                    <FileText size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-brand-red/20 bg-brand-red/10 text-brand-red transition-colors hover:bg-brand-red hover:text-[var(--ns-on-accent)] focus:outline-none focus:ring-1 focus:ring-brand-red"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={12} fill="currentColor" strokeWidth={0} /> : <Play size={12} fill="currentColor" strokeWidth={0} className="translate-x-[0.5px]" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    expandPlayer();
                  }}
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 hover:text-zinc-100 border border-zinc-800 text-ns-meta font-bold text-zinc-400 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-red"
                  aria-label="Expand player"
                >
                  {t('player.expand')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => expandPlayer()}
              className="fixed bottom-6 right-8 z-[var(--ns-z-dropdown)] flex animate-fade-in cursor-pointer items-center gap-2 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] px-4 py-3 font-sans text-ns-meta font-medium text-zinc-400 shadow-2xl transition-colors hover:border-brand-red/40 hover:bg-surface-hover hover:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-red"
              aria-label="Expand player"
            >
              <Music size={14} className="text-brand-red animate-pulse" />
              <span>{t('player.openPlayer')}</span>
            </button>
          )}
        </div>
      )}

      {/* Desktop Full Player Bar (slides down/up) */}
      <div
        data-testid="desktop-player"
        aria-hidden={isPlayerCollapsed || undefined}
        inert={isPlayerCollapsed || undefined}
        className={`ns-desktop-player fixed inset-x-0 z-[var(--ns-z-player)] hidden select-none items-center justify-between border-t border-[var(--ns-border-subtle)] bg-[var(--ns-player-bg)] px-4 transition-all duration-200 ease-in-out md:px-8 lg:flex ${desktopPlayerHeight} ${
          isPlayerCollapsed
            ? `${desktopHiddenPosition} opacity-0 pointer-events-none`
            : 'bottom-0 opacity-100'
        }`}
      >
        {!currentTrack ? (
          <div className="relative w-full flex items-center justify-between px-2 sm:px-4">
            <div className="flex items-center space-x-3">
              <div data-testid="player-accent-indicator" className="flex h-7 w-7 items-center justify-center rounded-md border border-brand-red/25 bg-brand-red/10 text-brand-red">
                <Music size={13} />
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="font-bold text-zinc-300">{t('player.playerReady')}</span>
                <span className="hidden sm:inline text-zinc-500">• {t('player.selectTrackToStart')}</span>
              </div>
            </div>
            <button
              onClick={() => collapsePlayer()}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer rounded-md hover:bg-zinc-900/60"
              title="Collapse Player"
              aria-label="Collapse player"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <DesktopPlayerBarContent
            track={currentTrack}
            isPlaying={isPlaying}
            volume={volume}
            progress={progress}
            duration={duration}
            repeatMode={repeatMode}
            shuffle={shuffle}
            isLiked={isLiked}
            playbackError={playbackError}
            lyricsAvailable={lyricsAvailable}
            lyricsActive={lyricsFullscreenOpen}
            isQueueOpen={isQueueOpen}
            onTogglePlay={togglePlay}
            onPrevious={previous}
            onNext={next}
            onSeek={seek}
            onSetVolume={setVolume}
            onToggleShuffle={toggleShuffle}
            onToggleRepeat={toggleRepeat}
            onToggleLike={() => toggleLikeTrack(currentTrack.id)}
            onLyrics={openLyricsFullscreen}
            onToggleQueue={onToggleQueue}
            onClose={collapsePlayer}
            closeLabel="Collapse player"
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE PLAYBACK CONTROLLERS (lg:hidden)                                */}
      {/* ========================================================================= */}

      {/* Mobile Collapsed Mini-Player (sitting above MobileNavbar bottom-16) */}
      {isPlayerCollapsed && (
        <div className="lg:hidden select-none">
          {currentTrack ? (
            <div
              onClick={() => expandPlayer()}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                trackContextMenuProps.onKeyDown(event);
                if (event.defaultPrevented) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  expandPlayer();
                }
              }}
              onContextMenu={trackContextMenuProps.onContextMenu}
              role="group"
              tabIndex={0}
              aria-label="Collapsed player"
              data-testid="mobile-collapsed-player"
              className="fixed inset-x-0 bottom-[var(--ns-mobile-nav-height)] z-[var(--ns-z-player)] flex h-[var(--ns-mobile-player-height)] cursor-pointer items-center justify-between border-t border-[var(--ns-border-subtle)] bg-[var(--ns-player-bg)] px-3 focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              {/* Progress Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-zinc-900">
                <div
                  className="h-full bg-brand-red transition-all duration-100"
                  style={{ width: `${(progress / (duration || 100)) * 100}%` }}
                />
              </div>
              {/* Details */}
              <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                <FallbackCover
                  src={currentTrack.coverUrl}
                  title={currentTrack.title}
                  artistName={currentTrack.artistName}
                  genre={currentTrack.genre}
                  className="w-10 h-10 rounded-lg border border-zinc-900 shrink-0"
                  imageClassName="object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h5 className="truncate text-ns-body-sm font-bold leading-snug text-zinc-200">
                    <Link
                      to={`/track/${currentTrack.id}`}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={trackContextMenuProps.onKeyDown}
                      className="block truncate focus-visible:underline focus-visible:outline-none"
                    >
                      {currentTrack.title}
                    </Link>
                  </h5>
                  {playbackError ? (
                    <PlaybackErrorStatus error={playbackError} className="mt-0.5" />
                  ) : (
                    <p className="text-ns-label text-zinc-400 truncate mt-0.5 font-medium">{currentTrack.artistName}</p>
                  )}
                </div>
              </div>
              {/* Controls */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[var(--ns-player-control-bg)] text-[var(--ns-player-control-text)] focus:outline-none"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={13} fill="currentColor" strokeWidth={0} /> : <Play size={13} fill="currentColor" strokeWidth={0} className="translate-x-[0.5px]" />}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    expandPlayer();
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-500"
                  aria-label="Expand player"
                >
                  <ChevronDown size={18} className="rotate-180" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => expandPlayer()}
              className="fixed bottom-[calc(var(--ns-mobile-nav-height)+1rem)] right-4 z-[var(--ns-z-player)] flex animate-fade-in cursor-pointer items-center gap-2 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] px-4 py-2.5 font-sans text-ns-meta font-medium text-zinc-400 shadow-2xl transition-colors hover:border-brand-red/40 hover:bg-surface-hover hover:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-red"
              aria-label="Expand player"
            >
              <Music size={13} className="text-brand-red animate-pulse" />
              <span>{t('player.openPlayer')}</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile Expanded Player Sheet (Slides up covering screen) */}
      {mobileSheetOpen && (
        <div
          ref={mobileSheetRef}
          onContextMenu={trackContextMenuProps.onContextMenu}
          role="dialog"
          aria-modal="true"
          aria-label={`${t('player.nowPlaying')}: ${currentTrack.title}`}
          data-testid="mobile-now-playing-sheet"
          className="ns-mobile-player-sheet fixed inset-0 z-[var(--ns-z-player-sheet)] flex translate-y-0 select-none flex-col justify-between overflow-hidden bg-[var(--ns-bg)] px-5 pb-[calc(1.5rem+var(--ns-safe-area-bottom))] pt-[calc(1.25rem+var(--ns-safe-area-top))] transition-transform duration-300 ease-out sm:px-6 lg:hidden"
        >
          {/* Top row */}
          <div className="ns-mobile-player-sheet__header flex shrink-0 items-center justify-between">
            <button
              onClick={() => collapsePlayer()}
              className="ns-icon-button !bg-zinc-900/80 text-zinc-400 cursor-pointer"
              aria-label="Collapse player"
            >
              <ChevronDown size={20} />
            </button>
            <span className="text-ns-meta font-bold uppercase tracking-ns-label text-zinc-400">{t('player.nowPlaying')}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openTrackActions}
                className="ns-icon-button !bg-zinc-900/80 text-zinc-500"
                aria-label={`More actions for ${currentTrack.title}`}
                aria-haspopup="menu"
              >
                <MoreHorizontal size={18} />
              </button>
              <button
                onClick={() => lyricsAvailable && openLyricsFullscreen()}
                disabled={!lyricsAvailable}
                className={`ns-icon-button !bg-zinc-900/80 ${
                  lyricsAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-35'
                } ${lyricsFullscreenOpen ? 'text-brand-red !border-brand-red/30' : 'text-zinc-500'}`}
                title={lyricsAvailable ? t('player.lyrics') : t('player.lyricsUnavailable')}
                aria-label={lyricsAvailable ? t('player.openLyrics') : t('player.lyricsUnavailable')}
                aria-pressed={lyricsFullscreenOpen}
              >
                <FileText size={18} />
              </button>
              <button
                onClick={onToggleQueue}
                className={`ns-icon-button !bg-zinc-900/80 cursor-pointer ${
                  isQueueOpen ? 'text-brand-red !border-brand-red/30' : 'text-zinc-500'
                }`}
                title="Queue"
                aria-label="Open play queue"
                aria-expanded={isQueueOpen}
              >
                <ListMusic size={18} />
              </button>
            </div>
          </div>

          {/* Large cover art */}
          <div className="ns-mobile-player-sheet__artwork my-auto flex min-h-0 max-h-[38vh] flex-1 items-center justify-center py-3 sm:py-6">
            <FallbackCover
              src={currentTrack.coverUrl}
              title={currentTrack.title}
              artistName={currentTrack.artistName}
              genre={currentTrack.genre}
              className="mobile-player-cover aspect-square h-full max-h-[34vh] w-auto rounded-lg border border-[var(--ns-border)] shadow-2xl"
              imageClassName="object-cover"
            />
          </div>

          {/* Controls details block */}
          <div className="ns-mobile-player-sheet__controls shrink-0 space-y-5">
            {/* Meta + Like */}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="ns-fullscreen-compact-title truncate text-2xl font-bold text-zinc-100">
                  <Link
                    to={`/track/${currentTrack.id}`}
                    onClick={collapsePlayer}
                    className="block truncate focus-visible:underline focus-visible:outline-none"
                  >
                    {currentTrack.title}
                  </Link>
                </h2>
                <p className="mt-1 truncate text-sm font-medium text-zinc-400">{currentTrack.artistName}</p>
                <PlaybackErrorStatus error={playbackError} className="mt-1" />
              </div>
              <button
                onClick={() => toggleLikeTrack(currentTrack.id)}
                className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors focus:outline-none ${
                  isLiked
                    ? 'bg-rose-500/10 text-brand-red border-brand-red/35'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Like"
                aria-label={isLiked ? `Unlike ${currentTrack.title}` : `Like ${currentTrack.title}`}
                aria-pressed={isLiked}
              >
                <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
              </button>
            </div>

            <MobilePlayerProgress progress={progress} duration={duration} onSeek={seek} />
            <MobilePlayerTransportControls
              isPlaying={isPlaying}
              shuffle={shuffle}
              repeatMode={repeatMode}
              onTogglePlay={togglePlay}
              onPrevious={previous}
              onNext={next}
              onToggleShuffle={toggleShuffle}
              onToggleRepeat={toggleRepeat}
            />

            {/* volume bar */}
            <div className="ns-mobile-player-sheet__volume flex items-center space-x-3 pb-3 pt-1">
              <button onClick={toggleMute} className="min-w-11 min-h-11 flex items-center justify-center text-zinc-500 focus:outline-none" aria-label={volume === 0 ? 'Unmute' : 'Mute'}>
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="premium-slider flex-1"
                aria-label="Volume"
                style={{
                  '--slider-progress': `${volume * 100}%`
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
