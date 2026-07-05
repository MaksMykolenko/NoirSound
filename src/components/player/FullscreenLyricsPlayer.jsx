import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  FileText,
  ListMusic,
  RotateCcw,
} from 'lucide-react';
import { getTrackLyrics } from '../../api/lyrics';
import { usePlayerStore } from '../../store/playerStore';
import FallbackCover from '../ui/FallbackCover';
import QueuePanel from './QueuePanel';
import {
  DesktopPlayerBarContent,
  MobilePlayerProgress,
  MobilePlayerTransportControls,
  PlayerTrackInfo,
} from './PlayerBarShared';
import {
  cacheFullscreenLyrics,
  deleteCachedFullscreenLyrics,
  getCachedFullscreenLyrics,
} from './fullscreenLyricsCache';

const HISTORY_STATE_KEY = '__noirsoundLyricsFullscreen';
const noop = () => {};

export default function FullscreenLyricsPlayer({
  isQueueOpen = false,
  onToggleQueue = noop,
  onCloseQueue = noop,
}) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [lyrics, setLyrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle,
    repeatMode,
    playbackError,
    likedTracks,
    closeLyricsFullscreen,
    togglePlay,
    previous,
    next,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    toggleLikeTrack,
  } = usePlayerStore();

  const closeWithHistory = useCallback(() => {
    const ownsHistoryEntry = Boolean(window.history.state?.[HISTORY_STATE_KEY]);
    closeLyricsFullscreen();
    if (ownsHistoryEntry) {
      window.setTimeout(() => window.history.back(), 0);
    }
  }, [closeLyricsFullscreen]);

  useEffect(() => {
    if (!currentTrack) {
      closeLyricsFullscreen();
    }
  }, [closeLyricsFullscreen, currentTrack]);

  useEffect(() => {
    if (!currentTrack?.id) return undefined;

    const cachedLyrics = getCachedFullscreenLyrics(currentTrack.id);
    if (cachedLyrics) {
      setLyrics(cachedLyrics);
      setLoadFailed(false);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLyrics(null);
    setLoadFailed(false);
    setLoading(true);

    getTrackLyrics(currentTrack.id)
      .then((response) => {
        if (cancelled) return;
        cacheFullscreenLyrics(currentTrack.id, response);
        setLyrics(response);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, retryVersion]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    if (!window.history.state?.[HISTORY_STATE_KEY]) {
      window.history.pushState(
        { ...window.history.state, [HISTORY_STATE_KEY]: true },
        '',
        window.location.href
      );
    }

    const handlePopState = () => {
      closeLyricsFullscreen();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (isQueueOpen) {
          onCloseQueue();
        } else {
          closeWithHistory();
        }
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || [])].filter((element) => (
        typeof element.checkVisibility !== 'function' || element.checkVisibility()
      ));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('keydown', handleKeyDown, true);
    closeRef.current?.focus();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      previousFocusRef.current?.focus?.();
    };
  }, [closeLyricsFullscreen, closeWithHistory, isQueueOpen, onCloseQueue]);

  if (!currentTrack) return null;

  const isLiked = likedTracks.includes(currentTrack.id);
  const retry = () => {
    deleteCachedFullscreenLyrics(currentTrack.id);
    setRetryVersion((version) => version + 1);
  };

  return (
    <section
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('lyrics.fullscreenLabel', { title: currentTrack.title })}
      data-testid="fullscreen-lyrics-player"
      className="ns-lyrics-fullscreen fixed inset-0 z-[200] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#07070a] text-white"
    >
      {currentTrack.coverUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-3rem] scale-110 bg-cover bg-center opacity-25 blur-[90px]"
          style={{ backgroundImage: `url("${currentTrack.coverUrl}")` }}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,color-mix(in_srgb,var(--ns-accent)_24%,transparent),transparent_36%),radial-gradient(circle_at_84%_80%,color-mix(in_srgb,var(--ns-accent-secondary)_18%,transparent),transparent_34%),linear-gradient(145deg,rgba(8,8,12,.82),rgba(5,5,8,.96))]"
      />

      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/8 px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:py-5">
        <button
          ref={closeRef}
          type="button"
          onClick={closeWithHistory}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-zinc-200 backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/8 hover:text-white"
          aria-label={t('player.closeLyrics')}
          title={t('lyrics.backToPlayer')}
          data-testid="fullscreen-lyrics-back"
        >
          <ArrowLeft size={21} />
        </button>
        <FallbackCover
          src={currentTrack.coverUrl}
          title={currentTrack.title}
          artistName={currentTrack.artistName}
          genre={currentTrack.genre}
          className="h-11 w-11 shrink-0 rounded-xl border border-white/10 shadow-xl sm:h-12 sm:w-12"
          imageClassName="object-cover"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300 sm:text-[11px]">
            {t('player.lyricsFullscreenTitle')}
          </p>
          <h1 className="truncate text-sm font-black text-white sm:text-base">{currentTrack.title}</h1>
          <p className="truncate text-xs font-medium text-zinc-400 sm:text-sm">{currentTrack.artistName}</p>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[min(31vw,28rem)] shrink-0 flex-col justify-end border-r border-white/8 p-8 lg:flex xl:p-12">
          <FallbackCover
            src={currentTrack.coverUrl}
            title={currentTrack.title}
            artistName={currentTrack.artistName}
            genre={currentTrack.genre}
            className="aspect-square w-full max-w-sm rounded-[2rem] border border-white/10 shadow-[0_28px_90px_rgba(0,0,0,.55)]"
            imageClassName="object-cover"
          />
          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">{t('player.nowPlaying')}</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{currentTrack.title}</h2>
            <p className="mt-1 text-base font-semibold text-zinc-400">{currentTrack.artistName}</p>
          </div>
        </aside>

        <div
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 sm:px-10 sm:py-12 lg:px-[clamp(3rem,7vw,7rem)] lg:py-16"
          data-testid="fullscreen-lyrics-scroll"
        >
          {loading ? (
            <div className="mx-auto max-w-4xl space-y-5 animate-pulse" role="status" aria-label={t('lyrics.loading')}>
              {[82, 64, 91, 56, 74, 87, 62].map((width) => (
                <div key={width} className="h-7 rounded-lg bg-white/8 sm:h-9" style={{ width: `${width}%` }} />
              ))}
              <span className="sr-only">{t('lyrics.loading')}</span>
            </div>
          ) : loadFailed ? (
            <div className="grid min-h-full place-items-center py-12 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400">
                  <FileText size={28} />
                </div>
                <h2 className="mt-5 text-xl font-black text-white">{t('lyrics.unavailable')}</h2>
                <button type="button" onClick={retry} className="ns-button-primary mt-6 inline-flex items-center gap-2 px-5">
                  <RotateCcw size={16} />
                  {t('lyrics.retry')}
                </button>
              </div>
            </div>
          ) : lyrics?.hasLyrics && lyrics.lyricsText ? (
            <div className="mx-auto max-w-4xl">
              <p className="whitespace-pre-wrap break-words text-[clamp(1.4rem,3vw,2.7rem)] font-black leading-[1.55] tracking-[-0.025em] text-zinc-100">
                {lyrics.lyricsText}
              </p>
              <p className="mt-14 border-t border-white/10 pt-5 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                {t('lyrics.providedByArtist')}
              </p>
            </div>
          ) : (
            <div className="grid min-h-full place-items-center py-12 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400">
                  <FileText size={28} />
                </div>
                <h2 className="mt-5 text-xl font-black text-white">{t('lyrics.noLyrics')}</h2>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-10 shrink-0" data-testid="fullscreen-lyrics-controls">
        <div
          className="hidden h-[90px] items-center justify-between border-t border-zinc-800/60 bg-zinc-950/92 px-4 backdrop-blur-xl glass-panel select-none md:px-8 lg:flex"
          data-testid="fullscreen-standard-desktop-playerbar"
        >
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
            lyricsAvailable
            lyricsActive
            isQueueOpen={isQueueOpen}
            onTogglePlay={togglePlay}
            onPrevious={previous}
            onNext={next}
            onSeek={seek}
            onSetVolume={setVolume}
            onToggleShuffle={toggleShuffle}
            onToggleRepeat={toggleRepeat}
            onToggleLike={() => toggleLikeTrack(currentTrack.id)}
            onLyrics={closeWithHistory}
            onToggleQueue={onToggleQueue}
            onClose={closeWithHistory}
            closeLabel={t('player.closeLyrics')}
          />
        </div>

        <div
          className="space-y-2 border-t border-zinc-800/60 bg-zinc-950/94 px-4 pb-[calc(.65rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl glass-panel select-none lg:hidden"
          data-testid="fullscreen-standard-mobile-playerbar"
        >
          <div className="flex min-w-0 items-center gap-1">
            <PlayerTrackInfo
              track={currentTrack}
              isLiked={isLiked}
              onToggleLike={() => toggleLikeTrack(currentTrack.id)}
              playbackError={playbackError}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={closeWithHistory}
              className="ns-icon-button !min-h-10 !min-w-10 !bg-zinc-900/80 text-brand-red !border-brand-red/30"
              aria-label={t('player.closeLyrics')}
              aria-pressed={true}
            >
              <FileText size={17} />
            </button>
            <button
              type="button"
              onClick={onToggleQueue}
              className={`ns-icon-button !min-h-10 !min-w-10 !bg-zinc-900/80 ${
                isQueueOpen ? 'text-brand-red !border-brand-red/30' : 'text-zinc-500'
              }`}
              aria-label="Open play queue"
              aria-expanded={isQueueOpen}
            >
              <ListMusic size={17} />
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
        </div>
      </footer>
      <QueuePanel isOpen={isQueueOpen} onClose={onCloseQueue} surface="fullscreen" />
    </section>
  );
}
