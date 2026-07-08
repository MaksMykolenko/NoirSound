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
        <section className="bg-brand-graphite/20 border border-zinc-900/60 p-6 md:p-8 ns-card-hero h-72"></section>
        <div className="h-28 bg-brand-graphite/40 border border-zinc-900/60 ns-card-hero"></div>
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
    `min-w-11 min-h-11 p-3 rounded-xl border transition-all cursor-pointer ${
      active
        ? 'bg-brand-red/12 text-brand-red border-brand-red/35'
        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
    }`;

  return (
    <div className="ns-page-stack animate-fade-in">
      <PageMeta
        title={`${track.title} — ${track.artistName} · NoirSound`}
        description={`${showGenre ? `${genreLabel} · ` : ''}${hasDuration ? `${durationStr} · ` : ''}Listen to ${track.title} by ${track.artistName} on NoirSound.`}
        canonical={`https://noirsound.co/track/${track.id}`}
      />

      {/* Hero + waveform form one connected unit */}
      <div className="space-y-4">

        {/* HERO */}
        <section
          className="relative overflow-hidden isolate ns-card ns-card-hero p-5 sm:p-7 md:p-8"
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
          {/* Blurred cover wash for a music-forward backdrop */}
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center opacity-[0.13] blur-3xl scale-110"
            style={{ backgroundImage: track.coverUrl ? `url('${track.coverUrl}')` : 'none' }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-br from-[var(--ns-accent-soft)] via-transparent to-transparent"
            aria-hidden="true"
          />

          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-end">
            {/* Cover */}
            <div className="relative shrink-0">
              <div
                className="absolute -inset-6 rounded-[2rem] bg-[var(--ns-accent-soft)] blur-3xl pointer-events-none"
                aria-hidden="true"
              />
              <FallbackCover
                src={track.coverUrl}
                title={track.title}
                artistName={track.artistName}
                genre={track.genre}
                className="relative w-44 h-44 sm:w-52 sm:h-52 md:w-60 md:h-60 rounded-2xl border border-[var(--ns-border)] shadow-[0_22px_60px_var(--ns-shadow-color)]"
                imageClassName="object-cover"
              />
            </div>

            {/* Track info + actions + metadata */}
            <div className="flex-1 min-w-0 space-y-4 text-center md:text-left">
              <div className="space-y-2.5">
                {showGenre && (
                  <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-red/10 border border-brand-red/30 text-rose-300 select-none">
                    {genreLabel}
                  </span>
                )}
                <h1 className="text-[1.75rem] sm:text-4xl lg:text-5xl font-black tracking-[-0.04em] text-zinc-100 break-words leading-[1.05]">
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
                  className="ns-button-primary px-6 text-xs uppercase tracking-widest flex items-center gap-2.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
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
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2.5 gap-y-1.5 text-[13px] text-zinc-500">
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
              <p className="text-xs text-zinc-500/90">{trackNote}</p>
            </div>
          </div>
        </section>

        {/* WAVEFORM — visually attached to the hero */}
        <section className="p-5 sm:p-6 ns-card space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="ns-eyebrow">{t('trackPage.waveform')}</h2>
            <span className="text-[11px] font-mono text-zinc-500 select-none">
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
            <p className="text-[11px] text-zinc-500 select-none">{t('trackPage.seekHint')}</p>
          )}
        </section>
      </div>

      <TrackLyricsCard
        track={track}
        canEdit={canEditLyrics}
        onLyricsChanged={handleLyricsChanged}
      />

      {/* Description + Comments / Related */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        {/* Description & Comments */}
        <div className="lg:col-span-2 space-y-6 lg:space-y-8">
          <div className="p-5 sm:p-6 ns-card space-y-3">
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
                    className="text-xs font-semibold text-zinc-400 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 ns-card">
            <CommentSection trackId={track.id} />
          </div>
        </div>

        {/* Related tracks */}
        <div className="space-y-4">
          <h2 className="ns-eyebrow px-1">{t('trackPage.relatedTracks')}</h2>
          {relatedTracks.length === 0 ? (
            <div className="ns-card p-5 text-center space-y-1.5">
              <p className="text-sm font-semibold text-zinc-300">{t('trackPage.noSimilarTitle')}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{t('trackPage.noSimilarDesc')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {relatedTracks.map((relTrack) => (
                <button
                  type="button"
                  key={relTrack.id}
                  onClick={() => navigate(`/track/${relTrack.id}`)}
                  className="w-full flex items-center gap-3 p-3 ns-card ns-card-interactive cursor-pointer group text-left"
                >
                  <FallbackCover
                    src={relTrack.coverUrl}
                    title={relTrack.title}
                    artistName={relTrack.artistName}
                    genre={relTrack.genre}
                    className="w-12 h-12 rounded-xl border border-zinc-850 shrink-0"
                    imageClassName="object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[13px] font-bold text-zinc-200 truncate group-hover:text-white">
                      {relTrack.title}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{relTrack.artistName}</p>
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
