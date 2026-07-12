import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageMeta from '../components/meta/PageMeta';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Heart, Plus, Check, Clock, Headphones, Share2, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useToastStore } from '../store/toastStore';
import { getTrackById, getTracks } from '../api';
import { formatDuration, formatTime } from '../utils/formatTime';
import { formatNumber } from '../utils/formatLocale';
import Waveform from '../components/player/Waveform';
import CommentSection from '../components/ui/CommentSection';
import ReportButton from '../components/ui/ReportButton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import FallbackCover from '../components/ui/FallbackCover';
import { sortTracksNewest } from '../utils/presentation';
import { getLocalizedGenre } from '../i18n/genreLabels';
import { normalizeGenre } from '../constants/musicGenres';
import TrackLyricsCard from '../components/lyrics/TrackLyricsCard';
import { useUserStore } from '../store/userStore';
import { useTrackContextMenu } from '../hooks/useEntityContextMenu';

function formatReleaseDate(iso, lang) {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleDateString(lang || 'en', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function TrackPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const user = useUserStore((state) => state.user);

  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    progress,
    duration,
    seek,
    likedTracks,
    toggleLikeTrack,
    queue,
    addToQueue,
    removeFromQueue,
    updateTrackMetadata
  } = usePlayerStore();

  const [track, setTrack] = useState(null);
  const [relatedTracks, setRelatedTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [t, allT] = await Promise.all([
          getTrackById(id),
          getTracks()
        ]);
        setTrack(t);
        const targetGenre = normalizeGenre(t.genre) || (t.genre || '').trim().toLowerCase();
        setRelatedTracks(
          sortTracksNewest(allT)
            .filter((candidate) => {
              if (candidate.id === t.id) return false;
              const candGenre = normalizeGenre(candidate.genre)
                || (candidate.genre || '').trim().toLowerCase();
              return Boolean(targetGenre) && candGenre === targetGenre;
            })
            .slice(0, 4)
        );
      } catch (err) {
        console.error('Failed to load track:', err);
        setError(err.status === 404 ? 'not-found' : (err.message || 'Failed to load track.'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <section className="h-72 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-6 md:p-8"></section>
        <div className="h-28 rounded-lg border border-zinc-800/60 bg-zinc-950/35"></div>
      </div>
    );
  }

  if (error === 'not-found' || (!loading && !track && !error)) {
    return (
      <EmptyState
        iconName="Disc3"
        title={t('trackPage.notFoundTitle')}
        description={t('trackPage.notFoundDesc')}
        actionText={t('trackPage.returnToDiscover')}
        onAction={() => navigate('/discover')}
      />
    );
  }

  if (error) {
    return <div className="py-16"><ErrorState title={t('trackPage.unavailableTitle')} message={error} /></div>;
  }

  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = likedTracks.includes(track.id);
  const inQueue = queue.some((qt) => qt.id === track.id);
  const canPlay = track.isStreamable ?? Boolean(track.audioUrl);
  const canEditLyrics = user?.role === 'ADMIN' || user?.artistProfileId === track.artistId;

  const genreLabel = getLocalizedGenre(track.genre);
  const showGenre = Boolean(genreLabel) && genreLabel !== 'No genre';
  const durationStr = formatDuration(track.duration);
  const hasDuration = durationStr !== '—';
  const releaseStr = formatReleaseDate(track.releaseDate, i18n.language);
  const playCount = Number(track.plays || 0);
  const trackNote = playCount === 0
    ? t('trackPage.beFirstToListen')
    : t('trackPage.uploadedBy', { name: track.artistName });

  const handlePlayClick = () => {
    if (!canPlay) return;
    if (isCurrent) togglePlay();
    else playTrack(track, [track]);
  };

  const handleQueueClick = () => {
    if (!canPlay) return;
    if (inQueue) removeFromQueue(track.id);
    else addToQueue(track);
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: track.title, url }); return; } catch { return; }
    }
    try { await navigator?.clipboard?.writeText(url); } catch { /* clipboard may be blocked */ }
    addToast(t('trackPage.linkCopied'), 'success');
  };

  const handleLyricsChanged = (result) => {
    const updates = {
      hasLyrics: result.hasLyrics,
      lyricsType: result.hasLyrics ? result.lyricsType : 'NONE',
    };
    setTrack((current) => current ? { ...current, ...updates } : current);
    updateTrackMetadata(track.id, updates);
    addToast(t('lyrics.saved'), 'success');
  };

  const iconActionClass = (active) =>
    `min-h-11 min-w-11 cursor-pointer rounded-md border p-3 transition-colors ${
      active
        ? 'bg-brand-red/12 text-brand-red border-brand-red/35'
        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
    }`;

  return (
    <div className="ns-page-stack">
      <PageMeta
        title={`${track.title} — ${track.artistName} · NoirSound`}
        description={`${showGenre ? `${genreLabel} · ` : ''}${hasDuration ? `${durationStr} · ` : ''}Listen to ${track.title} by ${track.artistName} on NoirSound.`}
        canonical={`https://noirsound.co/track/${track.id}`}
      />

      {/* Hero + waveform form one connected unit */}
      <div className="space-y-4">

        {/* HERO */}
        <section
          className="relative isolate overflow-hidden rounded-lg border border-[var(--ns-border)] bg-zinc-950/35 p-5 sm:p-6"
          onContextMenu={contextMenuProps.onContextMenu}
          onKeyDown={contextMenuProps.onKeyDown}
          tabIndex={0}
          data-testid="track-hero"
        >
          <button
            type="button"
            onClick={openFromButton}
            className="absolute right-4 top-4 z-20 ns-icon-button !min-h-10 !min-w-10 bg-zinc-950/70 text-zinc-300"
            aria-label={`More actions for ${track.title}`}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={17} />
          </button>
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-end">
            {/* Cover */}
            <div className="shrink-0">
              <FallbackCover
                src={track.coverUrl}
                title={track.title}
                artistName={track.artistName}
                genre={track.genre}
                className="h-44 w-44 rounded-md border border-zinc-700/70 sm:h-52 sm:w-52 md:h-56 md:w-56"
                imageClassName="object-cover"
              />
            </div>

            {/* Track info + actions + metadata */}
            <div className="flex-1 min-w-0 space-y-4 text-center md:text-left">
              <div className="space-y-2.5">
                {showGenre && (
                  <span className="inline-block rounded border border-brand-red/30 bg-[var(--ns-accent-soft)] px-2.5 py-1 font-sans tabular-nums text-ns-label font-medium uppercase tracking-ns-label text-rose-300 select-none">
                    {genreLabel}
                  </span>
                )}
                <h1 className="ns-display-title ns-display-title--entity text-zinc-100">
                  {track.title}
                </h1>
                <button
                  type="button"
                  onClick={() => navigate(`/artist/${track.artistId}`)}
                  className="text-zinc-400 hover:text-zinc-100 transition-colors font-semibold text-sm cursor-pointer"
                >
                  {track.artistName}
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <button
                  onClick={handlePlayClick}
                  disabled={!canPlay}
                  className="ns-button-primary px-6 text-sm flex items-center gap-2.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {isPlayingThis
                    ? <Pause size={16} fill="currentColor" strokeWidth={0} />
                    : <Play size={16} fill="currentColor" strokeWidth={0} className="translate-x-[0.5px]" />}
                  <span>{!canPlay ? t('trackPage.audioUnavailable') : isPlayingThis ? t('trackPage.pauseTrack') : t('trackPage.playTrack')}</span>
                </button>

                <button
                  onClick={() => toggleLikeTrack(track.id)}
                  className={iconActionClass(isLiked)}
                  title={isLiked ? t('trackPage.unlike') : t('trackPage.like')}
                  aria-label={isLiked ? t('trackPage.unlike') : t('trackPage.like')}
                  aria-pressed={isLiked}
                >
                  <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                </button>

                <button
                  onClick={handleQueueClick}
                  disabled={!canPlay}
                  className={`${iconActionClass(inQueue)} disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={inQueue ? t('trackPage.removeFromQueue') : t('trackPage.addToQueue')}
                  aria-label={inQueue ? t('trackPage.removeFromQueue') : t('trackPage.addToQueue')}
                  aria-pressed={inQueue}
                >
                  {inQueue ? <Check size={16} /> : <Plus size={16} />}
                </button>

                <button
                  onClick={handleShare}
                  className={iconActionClass(false)}
                  title={t('trackPage.share')}
                  aria-label={t('trackPage.share')}
                >
                  <Share2 size={16} />
                </button>

                <ReportButton targetType="TRACK" targetId={track.id} className="ml-1" />
              </div>

              {/* Compact metadata row (secondary, wraps on mobile) */}
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 font-sans tabular-nums text-ns-label text-zinc-500 md:justify-start">
                <span
                  className="inline-flex items-center gap-1.5"
                  aria-label={`${formatNumber(playCount)} ${t('trackPage.plays')}`}
                >
                  <Headphones size={14} className="opacity-70" aria-hidden="true" />
                  {formatNumber(playCount)}
                </span>
                {hasDuration && (
                  <>
                    <span aria-hidden="true" className="text-zinc-700">·</span>
                    <span className="inline-flex items-center gap-1.5" aria-label={t('trackPage.duration')}>
                      <Clock size={14} className="opacity-70" aria-hidden="true" />
                      {durationStr}
                    </span>
                  </>
                )}
                {releaseStr && (
                  <>
                    <span aria-hidden="true" className="text-zinc-700">·</span>
                    <span>{t('trackPage.releasedOn', { date: releaseStr })}</span>
                  </>
                )}
              </div>

              {/* Subtle contextual note */}
              <p className="text-sm text-zinc-500/90">{trackNote}</p>
            </div>
          </div>
        </section>

        {/* WAVEFORM — visually attached to the hero */}
        <section className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="ns-eyebrow">{t('trackPage.waveform')}</h2>
            <span className="text-ns-label font-sans tabular-nums text-zinc-500 select-none">
              {isCurrent ? `${formatTime(progress)} / ${formatTime(duration)}` : (hasDuration ? durationStr : '')}
            </span>
          </div>

          <Waveform
            samples={track.waveform}
            progress={isCurrent ? progress : 0}
            duration={isCurrent ? duration : track.duration}
            onSeek={isCurrent ? seek : null}
            barCount={80}
            height={56}
            unavailableLabel={t('trackPage.waveformUnavailable')}
          />

          {isCurrent && (
            <p className="text-ns-label text-zinc-500 select-none">{t('trackPage.seekHint')}</p>
          )}
        </section>
      </div>

      <TrackLyricsCard
        track={track}
        canEdit={canEditLyrics}
        onLyricsChanged={handleLyricsChanged}
      />

      {/* Description + Comments / Related */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] xl:gap-8">

        {/* Description & Comments */}
        <div className="min-w-0 space-y-6 xl:space-y-8">
          <div className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-5">
            <h2 className="ns-eyebrow">{t('trackPage.description')}</h2>
            {track.description ? (
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{track.description}</p>
            ) : (
              <p className="text-sm text-zinc-500">{t('trackPage.noDescription')}</p>
            )}
            {track.tags && track.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {track.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-sans tabular-nums text-ns-label text-zinc-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-4 sm:p-5">
            <CommentSection trackId={track.id} />
          </div>
        </div>

        {/* Related tracks */}
        <div className="space-y-4">
          <h2 className="ns-eyebrow px-1">{t('trackPage.relatedTracks')}</h2>
          {relatedTracks.length === 0 ? (
            <div className="space-y-1.5 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-5 text-center">
              <p className="text-sm font-semibold text-zinc-300">{t('trackPage.noSimilarTitle')}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{t('trackPage.noSimilarDesc')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {relatedTracks.map((relTrack) => (
                <button
                  type="button"
                  key={relTrack.id}
                  onClick={() => navigate(`/track/${relTrack.id}`)}
                  className="group flex w-full cursor-pointer items-center gap-3 rounded-md border border-zinc-800/60 bg-zinc-950/35 p-3 text-left transition-colors hover:border-zinc-700/70 hover:bg-zinc-900/40"
                >
                  <FallbackCover
                    src={relTrack.coverUrl}
                    title={relTrack.title}
                    artistName={relTrack.artistName}
                    genre={relTrack.genre}
                    className="h-12 w-12 shrink-0 rounded border border-zinc-800"
                    imageClassName="object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-ns-body-sm font-semibold text-zinc-200 group-hover:text-white">
                      {relTrack.title}
                    </h4>
                    <p className="text-ns-meta text-zinc-500 mt-0.5 truncate">{relTrack.artistName}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
