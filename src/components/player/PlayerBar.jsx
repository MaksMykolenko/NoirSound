import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  FileText
} from 'lucide-react';
import FallbackCover from '../ui/FallbackCover';
import {
  DesktopPlayerBarContent,
  MobilePlayerProgress,
  MobilePlayerTransportControls,
} from './PlayerBarShared';

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
  const desktopPlayerHeight = currentTrack ? 'h-[90px]' : 'h-[48px]';
  const desktopHiddenPosition = currentTrack ? 'bottom-[-90px]' : 'bottom-[-48px]';

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
              role="button"
              tabIndex={0}
              onClick={() => expandPlayer()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  expandPlayer();
                }
              }}
              className="fixed bottom-6 right-8 bg-zinc-950/95 border border-zinc-900/80 rounded-2xl p-2 flex items-center space-x-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.8)] z-50 glass-panel-light backdrop-blur-xl animate-fade-in text-xs max-w-[320px] h-14 hover:border-zinc-800 hover:scale-[1.02] transition-all duration-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-red"
              aria-label="Expand player"
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
                <h5 className="font-bold text-zinc-200 truncate leading-snug text-[13.5px]">{currentTrack.title}</h5>
                <p className="text-[12px] text-zinc-400 truncate mt-0.5 font-medium">{currentTrack.artistName}</p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                {lyricsAvailable && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openLyricsFullscreen();
                    }}
                    className="w-8 h-8 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 flex items-center justify-center hover:text-brand-red"
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
                  className="w-8 h-8 rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red flex items-center justify-center cursor-pointer hover:bg-brand-red hover:text-[var(--ns-on-accent)] transition-all shadow-[0_0_8px_var(--ns-accent-glow-soft)] focus:outline-none focus:ring-1 focus:ring-brand-red"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={12} fill="currentColor" strokeWidth={0} /> : <Play size={12} fill="currentColor" strokeWidth={0} className="translate-x-[0.5px]" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    expandPlayer();
                  }}
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 hover:text-zinc-100 border border-zinc-800 text-[10px] font-bold text-zinc-400 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-red"
                  aria-label="Expand player"
                >
                  {t('player.expand')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => expandPlayer()}
              className="fixed bottom-6 right-8 bg-zinc-950/95 hover:bg-zinc-900 border border-zinc-900 hover:border-brand-red/40 text-zinc-400 hover:text-zinc-100 px-4 py-3 rounded-2xl shadow-[0_4px_30px_var(--ns-shadow-color)] z-50 transition-all flex items-center space-x-2 text-xs font-bold uppercase tracking-wider cursor-pointer glass-panel-light animate-fade-in focus:outline-none focus:ring-1 focus:ring-brand-red"
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
        className={`hidden lg:flex fixed left-0 right-0 ${desktopPlayerHeight} bg-zinc-950/92 border-t border-zinc-800/60 backdrop-blur-xl z-50 items-center justify-between px-4 md:px-8 glass-panel select-none transition-all duration-300 ease-in-out ${
          isPlayerCollapsed
            ? `${desktopHiddenPosition} opacity-0 pointer-events-none`
            : 'bottom-0 opacity-100'
        }`}
      >
        {!currentTrack ? (
          <div className="relative w-full flex items-center justify-between px-2 sm:px-4">
            <div className="flex items-center space-x-3">
              <div data-testid="player-accent-indicator" className="w-7 h-7 rounded-lg bg-brand-red/10 border border-brand-red/25 text-brand-red flex items-center justify-center shadow-[0_0_10px_var(--ns-accent-glow-soft)]">
                <Music size={13} />
              </div>
              <div className="flex items-center space-x-2 text-xs">
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
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  expandPlayer();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Expand player"
              className="fixed bottom-16 left-0 right-0 h-[64px] bg-zinc-950/95 border-t border-zinc-900/80 backdrop-blur-lg z-30 flex items-center justify-between px-4 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-red"
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
                  <h5 className="font-bold text-zinc-200 text-[13.5px] truncate leading-snug">{currentTrack.title}</h5>
                  <p className="text-[12px] text-zinc-400 truncate mt-0.5 font-medium">{currentTrack.artistName}</p>
                </div>
              </div>
              {/* Controls */}
              <div className="flex items-center space-x-3 shrink-0">
                {lyricsAvailable && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openLyricsFullscreen();
                    }}
                    className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 flex items-center justify-center"
                    aria-label={t('player.openLyrics')}
                    aria-pressed={lyricsFullscreenOpen}
                  >
                    <FileText size={15} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="w-9 h-9 rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red flex items-center justify-center cursor-pointer focus:outline-none"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={13} fill="currentColor" strokeWidth={0} /> : <Play size={13} fill="currentColor" strokeWidth={0} className="translate-x-[0.5px]" />}
                </button>
                <span className="text-zinc-500 p-1">
                  <ChevronDown size={18} className="rotate-180" />
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => expandPlayer()}
              className="fixed bottom-20 right-4 bg-zinc-950/95 hover:bg-zinc-900 border border-zinc-900 hover:border-brand-red/40 text-zinc-400 hover:text-zinc-100 px-4 py-2.5 rounded-full shadow-[0_4px_25px_var(--ns-shadow-color)] z-30 transition-all flex items-center space-x-2 text-xs font-bold uppercase tracking-wider cursor-pointer glass-panel-light animate-fade-in focus:outline-none focus:ring-1 focus:ring-brand-red"
              aria-label="Expand player"
            >
              <Music size={13} className="text-brand-red animate-pulse" />
              <span>{t('player.openPlayer')}</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile Expanded Player Sheet (Slides up covering screen) */}
      {currentTrack && (
        <div
          className={`lg:hidden fixed inset-0 bg-brand-dark z-50 flex flex-col justify-between px-5 sm:px-6 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-transform duration-350 ease-out select-none overflow-hidden ${
            isPlayerCollapsed ? 'translate-y-full' : 'translate-y-0'
          }`}
        >
          {/* Blurred Background cover */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10 blur-3xl -z-10 scale-110"
            style={{ backgroundImage: currentTrack.coverUrl ? `url('${currentTrack.coverUrl}')` : 'none' }}
          />

          {/* Top row */}
          <div className="flex items-center justify-between shrink-0">
            <button
              onClick={() => collapsePlayer()}
              className="ns-icon-button !bg-zinc-900/80 text-zinc-400 cursor-pointer"
              aria-label="Collapse player"
            >
              <ChevronDown size={20} />
            </button>
            <span className="text-[12px] font-bold uppercase tracking-widest text-zinc-400">{t('player.nowPlaying')}</span>
            <div className="flex items-center gap-2">
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
          <div className="flex-1 flex items-center justify-center py-3 sm:py-6 min-h-0 max-h-[38vh] my-auto">
            <FallbackCover
              src={currentTrack.coverUrl}
              title={currentTrack.title}
              artistName={currentTrack.artistName}
              genre={currentTrack.genre}
              className="mobile-player-cover h-full max-h-[34vh] w-auto aspect-square rounded-3xl border border-zinc-700/70 shadow-[0_8px_40px_rgba(0,0,0,0.8)]"
              imageClassName="object-cover"
            />
          </div>

          {/* Controls details block */}
          <div className="space-y-6 shrink-0">
            {/* Meta + Like */}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-[19px] font-black text-zinc-100 truncate leading-tight">{currentTrack.title}</h2>
                <p className="text-[14px] text-zinc-300 font-semibold truncate mt-1">{currentTrack.artistName}</p>
              </div>
              <button
                onClick={() => toggleLikeTrack(currentTrack.id)}
                className={`w-10 h-10 inline-flex items-center justify-center shrink-0 rounded-xl border transition-colors cursor-pointer focus:outline-none ${
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
            <div className="flex items-center space-x-3 pt-1 pb-3 mb-[env(safe-area-inset-bottom)]">
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
            {playbackError && (
              <div className="p-3 rounded-xl border border-rose-400/25 bg-rose-500/10 text-sm text-rose-200" role="alert">
                {playbackError}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
