import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  FileText,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getTrackLyrics } from '../../api/lyrics';
import { usePlayerStore } from '../../store/playerStore';
import { formatTime } from '../../utils/formatTime';
import FallbackCover from '../ui/FallbackCover';
import {
  cacheFullscreenLyrics,
  deleteCachedFullscreenLyrics,
  getCachedFullscreenLyrics,
} from './fullscreenLyricsCache';

const HISTORY_STATE_KEY = '__noirsoundLyricsFullscreen';

export default function FullscreenLyricsPlayer() {
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
    closeLyricsFullscreen,
    togglePlay,
    previous,
    next,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
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
        closeWithHistory();
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
  }, [closeLyricsFullscreen, closeWithHistory]);

  if (!currentTrack) return null;

  const progressPercent = Math.min(100, Math.max(0, (progress / (duration || 100)) * 100));
  const toggleMute = () => setVolume(volume > 0 ? 0 : 0.5);
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

      <footer
        className="relative z-10 shrink-0 border-t border-white/10 bg-black/35 px-4 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl sm:px-8 sm:pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pt-3 lg:px-12"
        data-testid="fullscreen-lyrics-controls"
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-zinc-400 sm:gap-3 sm:text-xs">
            <span className="w-9 text-right">{formatTime(progress)}</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={progress}
              onChange={(event) => seek(parseFloat(event.target.value))}
              className="premium-slider min-w-0 flex-1"
              aria-label="Track progress"
              style={{ '--slider-progress': `${progressPercent}%` }}
            />
            <span className="w-9">{formatTime(duration)}</span>
          </div>

          <div className="mt-1 flex items-center justify-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={toggleShuffle}
              className={`hidden min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors sm:inline-flex ${
                shuffle ? 'text-rose-300' : 'text-zinc-500 hover:text-white'
              }`}
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
            >
              <Shuffle size={18} />
            </button>
            <button
              type="button"
              onClick={previous}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Previous track"
            >
              <SkipBack size={22} fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-purple-500 text-white shadow-[0_12px_34px_color-mix(in_srgb,var(--ns-accent)_28%,transparent)] transition-transform hover:scale-105 sm:h-16 sm:w-16"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <Pause size={23} fill="currentColor" strokeWidth={0} />
                : <Play size={23} fill="currentColor" strokeWidth={0} className="translate-x-0.5" />}
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Next track"
            >
              <SkipForward size={22} fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={toggleRepeat}
              className={`hidden min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors sm:inline-flex ${
                repeatMode !== 'none' ? 'text-rose-300' : 'text-zinc-500 hover:text-white'
              }`}
              aria-label={`Change repeat mode. Current mode: ${repeatMode}`}
            >
              <Repeat size={18} />
            </button>

            <div className="absolute right-6 hidden items-center gap-2 lg:flex xl:right-12">
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-zinc-400 hover:text-white"
                aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => setVolume(parseFloat(event.target.value))}
                className="premium-slider w-24"
                aria-label="Volume"
                style={{ '--slider-progress': `${volume * 100}%` }}
              />
            </div>
          </div>
          {playbackError && <p className="mt-1 text-center text-xs text-rose-200" role="alert">{playbackError}</p>}
        </div>
      </footer>
    </section>
  );
}
