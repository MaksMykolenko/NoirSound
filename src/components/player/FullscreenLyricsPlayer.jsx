import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  FileText,
  ListMusic,
  RotateCcw,
} from 'lucide-react';
import { getTrackLyrics } from '../../api/lyrics';
import { usePlayerStore } from '../../store/playerStore';
import FallbackCover from '../ui/FallbackCover';
import QueuePanel from './QueuePanel';
import FullscreenArtworkBackdrop from './FullscreenArtworkBackdrop';
import FullscreenLyricsText from './FullscreenLyricsText';
import './fullscreen-player.css';
import {
  DesktopPlayerBarContent,
  MobilePlayerProgress,
  MobilePlayerTransportControls,
  PlaybackErrorStatus,
  PlayerTrackInfo,
} from './PlayerBarShared';
import {
  cacheFullscreenLyrics,
  deleteCachedFullscreenLyrics,
  getCachedFullscreenLyrics,
} from './fullscreenLyricsCache';
import { isUnmodifiedPrimaryActivation } from '../../utils/linkActivation';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';

const HISTORY_STATE_KEY = '__noirsoundLyricsFullscreen';
const noop = () => {};

export default function FullscreenLyricsPlayer({
  isQueueOpen = false,
  onToggleQueue = noop,
  onCloseQueue = noop,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lyricsScrollRef = useRef(null);
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
    collapsePlayer,
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

  const dialogRef = useDialogFocusTrap(Boolean(currentTrack), closeWithHistory);

  const closeForNavigation = useCallback((event) => {
    if (!isUnmodifiedPrimaryActivation(event)) return;

    const ownsHistoryEntry = Boolean(window.history.state?.[HISTORY_STATE_KEY]);
    onCloseQueue();
    if (window.matchMedia?.('(max-width: 1023px)').matches) {
      collapsePlayer();
    }
    closeLyricsFullscreen();
    if (ownsHistoryEntry) {
      event.preventDefault();
      const trackPath = event.currentTarget.getAttribute('href') || `/track/${currentTrack.id}`;
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` === trackPath) {
        navigate(-1);
      } else {
        navigate(trackPath, { replace: true });
      }
    }
  }, [closeLyricsFullscreen, collapsePlayer, currentTrack?.id, navigate, onCloseQueue]);

  useEffect(() => {
    if (!currentTrack) {
      closeLyricsFullscreen();
    }
  }, [closeLyricsFullscreen, currentTrack]);

  useEffect(() => {
    if (!currentTrack?.id) return undefined;

    if (lyricsScrollRef.current) {
      lyricsScrollRef.current.scrollTop = 0;
      const stage = lyricsScrollRef.current.closest('.ns-immersive-stage');
      if (stage) stage.scrollTop = 0;
    }
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

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [closeLyricsFullscreen]);

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
      className="ns-lyrics-fullscreen ns-immersive-player"
    >
      <FullscreenArtworkBackdrop key={currentTrack.coverUrl || 'no-cover'} src={currentTrack.coverUrl} paused={!isPlaying} />
      <header className="ns-immersive-header">
        <button
          type="button"
          onClick={closeWithHistory}
          className="ns-immersive-close"
          aria-label={t('player.closeLyrics')}
          title={t('lyrics.backToPlayer')}
          data-testid="fullscreen-lyrics-back"
        >
          <ChevronDown size={24} />
        </button>
        <div className="ns-immersive-heading">
          <span>{t('player.nowPlaying')}</span>
          <h1 className="sr-only">{currentTrack.title}</h1>
          <PlaybackErrorStatus error={playbackError} />
        </div>
        <span className="ns-immersive-wordmark" aria-hidden="true">NoirSound</span>
      </header>

      <main className="ns-immersive-stage">
        <aside className="ns-immersive-record">
          <FallbackCover
            key={currentTrack.id}
            src={currentTrack.coverUrl}
            title={currentTrack.title}
            artistName={currentTrack.artistName}
            genre={currentTrack.genre}
            loading="eager"
            className="ns-immersive-cover"
            imageClassName="object-cover"
          />
          <div className="ns-immersive-identity" data-testid="fullscreen-track-info">
            <PlayerTrackInfo
              track={currentTrack}
              isLiked={isLiked}
              onToggleLike={() => toggleLikeTrack(currentTrack.id)}
              onOpenTrack={closeForNavigation}
              className="min-w-0 w-full"
            />
          </div>
        </aside>

        <div
          key={currentTrack.id}
          ref={lyricsScrollRef}
          className="ns-immersive-lyrics"
          data-testid="fullscreen-lyrics-scroll"
          tabIndex={0}
          role="region"
          aria-label={t('player.lyrics')}
          aria-busy={loading}
        >
          {loading ? (
            <div className="mx-auto max-w-4xl space-y-5 animate-pulse" role="status" aria-label={t('lyrics.loading')}>
              {[82, 64, 91, 56, 74, 87, 62].map((width) => (
                <div key={width} className="h-7 rounded bg-white/8 sm:h-9" style={{ width: `${width}%` }} />
              ))}
              <span className="sr-only">{t('lyrics.loading')}</span>
            </div>
          ) : loadFailed ? (
            <div className="ns-immersive-empty">
              <div className="max-w-sm">
                <div className="ns-immersive-empty-icon">
                  <FileText size={28} />
                </div>
                <h2 className="mt-5 font-sans text-xl font-bold text-zinc-100">{t('lyrics.unavailable')}</h2>
                <button type="button" onClick={retry} className="ns-button-primary mt-6 inline-flex items-center gap-2 px-5">
                  <RotateCcw size={16} />
                  {t('lyrics.retry')}
                </button>
              </div>
            </div>
          ) : lyrics?.hasLyrics && (lyrics.lyricsText || lyrics.lyricsSynced?.length) ? (
            <FullscreenLyricsText
              key={currentTrack.id}
              lyrics={lyrics}
              progress={progress}
              onSeek={seek}
              scrollRef={lyricsScrollRef}
            />
          ) : (
            <div className="ns-immersive-empty">
              <div className="max-w-sm">
                <div className="ns-immersive-empty-icon">
                  <FileText size={28} />
                </div>
                <h2 className="mt-5 font-sans text-xl font-bold text-zinc-100">{t('lyrics.noLyrics')}</h2>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="ns-immersive-footer" data-testid="fullscreen-lyrics-controls">
        <div className="ns-immersive-desktop-controls" data-testid="fullscreen-standard-desktop-playerbar">
          <DesktopPlayerBarContent
            track={currentTrack}
            showTrackInfo={false}
            isPlaying={isPlaying}
            volume={volume}
            progress={progress}
            duration={duration}
            repeatMode={repeatMode}
            shuffle={shuffle}
            isLiked={isLiked}
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
            onOpenTrack={closeForNavigation}
          />
        </div>
        <div className="ns-immersive-mobile-controls" data-testid="fullscreen-standard-mobile-playerbar">
          <button
            type="button"
            onClick={onToggleQueue}
            className="ns-immersive-queue"
            aria-label={t('player.openQueue')}
            aria-expanded={isQueueOpen}
          >
            <ListMusic size={20} />
          </button>
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
