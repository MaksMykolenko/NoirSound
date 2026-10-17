import { TrackSaveIcon, TrackPlayingIndicator } from '../components/tracks/TrackVisuals';
import TrackSourceIcon from '../components/tracks/TrackSourceIcon';
import { canPlayTrack } from '../utils/trackPlayback';
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import PageMeta from '../components/meta/PageMeta';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Clock, Headphones, MoreHorizontal, MessageCircle } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useToastStore } from '../store/toastStore';
import { getTrackById, getCatalogTracks } from '../api';
import { formatDuration, formatTime } from '../utils/formatTime';
import { formatNumber } from '../utils/formatLocale';
import Waveform from '../components/player/Waveform';
import CommentSection from '../components/ui/CommentSection';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import FallbackCover from '../components/ui/FallbackCover';
import FallbackAvatar from '../components/ui/FallbackAvatar';
import { getLocalizedGenre } from '../i18n/genreLabels';
import { normalizeGenre } from '../constants/musicGenres';
import TrackLyricsCard from '../components/lyrics/TrackLyricsCard';
import { useUserStore } from '../store/userStore';
import { useTrackContextMenu } from '../hooks/useEntityContextMenu';
import { TrackTypeBadge } from '../components/tracks/TrackContentMeta';
import { isBeatTrack } from '../utils/trackContent';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
    updateTrackMetadata
  } = usePlayerStore();

  const [track, setTrack] = useState(null);
  const [relatedTracks, setRelatedTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextTrack = await getTrackById(id);
        if (controller.signal.aborted) return;
        setTrack(nextTrack);
        const genre = normalizeGenre(nextTrack.genre);
        let related = [];
        if (genre) {
          const page = await getCatalogTracks({
            contentType: isBeatTrack(nextTrack) ? 'BEAT' : 'MUSIC',
            genre,
            sort: 'recent',
            limit: 5,
          }, { signal: controller.signal });
          // The server filters the complete catalog; one extra row allows
          // omitting the current track without underfilling this bounded rail.
          related = page.items.filter((candidate) => candidate.id !== nextTrack.id).slice(0, 4);
        }
        if (!controller.signal.aborted) setRelatedTracks(related);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load track:', err);
        setError(err.status === 404 ? 'not-found' : (err.message || 'Failed to load track.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [id, user?.id, navigate]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-8">
        <section className="grid grid-cols-1 items-end gap-6 px-1 py-4 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
          <div className="mx-auto aspect-square w-48 rounded-md bg-zinc-900 md:mx-0 md:w-56" />
          <div className="space-y-4">
            <div className="h-4 w-24 rounded bg-zinc-900" />
            <div className="h-14 w-4/5 rounded bg-zinc-900" />
            <div className="h-4 w-40 rounded bg-zinc-900" />
            <div className="h-11 w-52 rounded bg-zinc-900" />
          </div>
        </section>
        <div className="h-24 border-y border-zinc-800/60 bg-zinc-950/20" />
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
  const external = track.playbackSource === 'external';
  const canPlay = canPlayTrack(track);
  const canEditLyrics = !external && (user?.role === 'ADMIN' || user?.artistProfileId === track.artistId);
  const isBeat = isBeatTrack(track);
  const hasDetailSidebar = relatedTracks.length > 0;

  const genreLabel = getLocalizedGenre(track.genre);
  const showGenre = Boolean(genreLabel) && genreLabel !== 'No genre';
  const durationStr = formatDuration(track.duration);
  const hasDuration = durationStr !== '—';
  const releaseStr = formatReleaseDate(track.releaseDate, i18n.language);
  const playCount = Number(track.plays || 0);
  const handlePlayClick = () => {
    if (!canPlay) return;
    if (isCurrent && track.playbackMode !== 'OFFICIAL_EMBED') togglePlay();
    else playTrack(track, [track]);
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
    `ns-track-detail-action min-h-11 min-w-11 cursor-pointer rounded-full p-3 transition-colors ${
      active
        ? 'bg-brand-red/12 text-brand-red border-brand-red/35'
        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-[var(--ns-text-primary)] hover:border-zinc-700'
    }`;

  return (
    <div className="ns-page-stack ns-track-detail">
      <PageMeta
        title={`${track.title} — ${track.artistName} · NoirSound`}
        description={`${showGenre ? `${genreLabel} · ` : ''}${hasDuration ? `${durationStr} · ` : ''}${isBeat ? 'Listen to this beat' : `Listen to ${track.title}`} by ${track.artistName} on NoirSound.`}
        canonical={`https://noirsound.co/track/${track.id}`}
        robots={external ? "noindex, nofollow" : undefined}
      />

      {/* Hero + waveform form one connected music-detail unit */}
      <div className="space-y-6">

        {/* HERO */}
        <section
          className={`ns-track-hero relative isolate grid scroll-mt-20 grid-cols-1 items-end gap-6 px-1 py-2 focus:outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-brand-red/50 sm:py-4 md:gap-8 ${isBeat ? 'md:grid-cols-[16rem_minmax(0,1fr)]' : 'md:grid-cols-[14rem_minmax(0,1fr)]'}`}
          onContextMenu={contextMenuProps.onContextMenu}
          onKeyDown={contextMenuProps.onKeyDown}
          tabIndex={0}
          data-testid="track-hero"
          data-is-beat={isBeat ? 'true' : 'false'}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={openFromButton}
                className="absolute right-1 top-1 z-20 ns-media-action ns-media-action--card bg-zinc-950/80 text-zinc-300 md:right-0 md:top-4"
                aria-label={t('playlists.moreActionsFor', { title: track.title })}
                aria-haspopup="menu"
              >
                <MoreHorizontal size={17} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{t('playlists.moreActionsFor', { title: track.title })}</TooltipContent>
          </Tooltip>
          <>
            {/* Cover */}
            <div className="ns-track-cover group relative mx-auto shrink-0 md:mx-0">
              <FallbackCover
                src={track?.coverUrl}
                title={track?.title}
                artistName={track?.artistName}
                genre={track?.genre}
                className={`h-48 w-48 rounded-md border border-[var(--ns-border)] shadow-sm sm:h-52 sm:w-52 ${isBeat ? 'md:h-64 md:w-64' : 'md:h-56 md:w-56'}`}
                imageClassName="object-cover"
              />
              {canPlay && (
                <button
                  type="button"
                  onClick={handlePlayClick}
                  aria-label={t(isPlayingThis ? 'playlists.pauseTrack' : 'playlists.playTrack', { title: track.title })}
                  data-testid="track-cover-play"
                  className={`ns-track-cover-play absolute inset-0 flex cursor-pointer items-center justify-center rounded-md bg-black/50 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ns-bg)] ${isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-red text-[var(--ns-on-accent)] shadow-xl">
                    {isPlayingThis
                      ? <Pause size={24} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                      : <Play size={24} fill="currentColor" strokeWidth={0} className="translate-x-0.5" aria-hidden="true" />}
                  </span>
                </button>
              )}
            </div>

            {/* Track info + actions + metadata */}
            <div className="min-w-0 space-y-4 text-center md:pr-12 md:text-left">
              <div className={`space-y-2.5 ${track.title.length > 60 ? 'ns-track-detail-title--long' : ''}`}>
                <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
                  <TrackTypeBadge track={track} />
                  <TrackSourceIcon track={track} />
                  {showGenre && (
                    <span className="text-sm text-zinc-400">
                      <span>{genreLabel}</span>
                    </span>
                  )}
                  {isPlayingThis && (
                    <span role="status" data-testid="track-now-playing" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-red">
                      <TrackPlayingIndicator />
                      {t('player.nowPlaying')}
                    </span>
                  )}
                </div>
                <h1 className="ns-display-title ns-display-title--entity text-zinc-100 ns-track-detail-title">
                  {track.title}
                </h1>
                {track.artistId ? (
                <Link
                  to={`/artist/${track.artistId}`}
                  className="inline-flex max-w-full items-center gap-2.5 break-words text-zinc-400 hover:text-zinc-100 transition-colors font-semibold text-sm cursor-pointer"
                >
                  <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-zinc-800" aria-hidden="true">
                    <FallbackAvatar src={track.artistAvatarUrl} name={track.artistName} className="h-full w-full" imageClassName="object-cover" />
                  </span>
                  <span className="min-w-0 break-words">{track.artistName}</span>
                </Link>
                ) : <span className="text-base text-zinc-300">{track.artistName}</span>}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
                <button
                  type="button"
                  onClick={handlePlayClick}
                  disabled={!canPlay}
                  className="ns-track-main-play"
                >
                  {isPlayingThis
                    ? <Pause size={16} fill="currentColor" strokeWidth={0} />
                    : <Play size={16} fill="currentColor" strokeWidth={0} className="translate-x-[0.5px]" />}
                  <span className="sr-only">{!canPlay ? t('trackPage.audioUnavailable') : isPlayingThis ? t('trackPage.pauseTrack') : isBeat ? t('beats.playBeat') : t('trackPage.playTrack')}</span>
                </button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleLikeTrack(track.id)}
                      className={iconActionClass(isLiked)}
                      aria-label={isLiked ? t('trackPage.unlike') : t('trackPage.like')}
                      aria-pressed={isLiked}
                    >
                      <TrackSaveIcon saved={isLiked} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{isLiked ? t('trackPage.unlike') : t('trackPage.like')}</TooltipContent>
                </Tooltip>

              </div>

              {/* Compact metadata row (secondary, wraps on mobile) */}
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 font-sans tabular-nums text-ns-label text-zinc-500 md:justify-start">
                {!external && <span
                  className="inline-flex items-center gap-1.5"
                  aria-label={`${formatNumber(playCount)} ${t('trackPage.plays')}`}
                >
                  <Headphones size={14} className="opacity-70" aria-hidden="true" />
                  {formatNumber(playCount)}
                </span>}
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

            </div>
          </>
        </section>

        {/* WAVEFORM — visually attached to the hero */}
        {track.playbackMode !== 'OFFICIAL_EMBED' && Array.isArray(track.waveform) && track.waveform.length > 0 && (
        <section className="space-y-3 border-y border-zinc-800/60 bg-zinc-950/15 px-1 py-5 sm:px-3">
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
        )}
      </div>

      {/* Lyrics, description, comments / conditional related rail */}
      <div
        className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8"
        data-testid="track-detail-layout"
        data-has-related={relatedTracks.length > 0 ? 'true' : 'false'}
      >

        {/* Main track details */}
        <div
          className={`min-w-0 space-y-6 xl:space-y-8 ${hasDetailSidebar ? 'xl:col-span-8' : 'xl:col-span-12'}`}
          data-testid="track-main-column"
        >
          {!external && (track.hasLyrics || canEditLyrics) && (
            <TrackLyricsCard
              track={track}
              canEdit={canEditLyrics}
              onLyricsChanged={handleLyricsChanged}
            />
          )}

          {isBeat && (
            <section className="space-y-4 border-t border-zinc-800/60 pt-6" data-testid="beat-details">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="ns-section-title">{t('beats.beatDetails')}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{t('beats.beatDetailsDescription')}</p>
                </div>
                {track.beatContactEnabled && (
                  <Link
                    to={`/artist/${track.artistId}#contact`}
                    className="ns-button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm"
                  >
                    <MessageCircle size={15} aria-hidden="true" />
                    {t('beats.contactProducer')}
                  </Link>
                )}
              </div>
              <dl className="ns-beat-metadata-strip">
                {[
                  [t('beats.bpm'), track.beatBpm],
                  [t('beats.key'), track.beatKey],
                  [t('beats.mood'), track.beatMood],
                  [t('beats.style'), track.beatStyle],
                ].filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => (
                  <div key={label} className="ns-beat-metadata-strip__item">
                    <dt className="sr-only">{label}</dt>
                    <dd><span>{value}</span>{label === t('beats.bpm') ? ' BPM' : ''}</dd>
                  </div>
                ))}
              </dl>
              {track.beatLicenseType && (
                <div className="ns-beat-terms">
                  <h3 className="ns-eyebrow">{t('beats.licenseType')}</h3>
                  <p>{track.beatLicenseType}</p>
                </div>
              )}
              {track.beatUsageNotes && (
                <div className="ns-beat-terms">
                  <h3 className="ns-eyebrow">{t('beats.usageNotes')}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{track.beatUsageNotes}</p>
                </div>
              )}
            </section>
          )}

          {(track.description || track.tags?.length > 0) && (
          <section className="space-y-3 border-t border-zinc-800/60 pt-6">
            <h2 className="ns-section-title">{t('trackPage.description')}</h2>
            {track.description ? (
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line break-words">{track.description}</p>
            ) : (
              <p className="text-sm text-zinc-500">{t('trackPage.noDescription')}</p>
            )}
            {track.tags && track.tags.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                {track.tags.map((tag) => (
                  <span
                    key={tag}
                    className="max-w-full break-words font-sans tabular-nums text-ns-label text-zinc-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </section>
          )}

          {!external && <section className="border-t border-zinc-800/60 pt-6">
            <CommentSection trackId={track.id} />
          </section>}
          {external && <section className="flex flex-wrap items-center gap-3 border-t border-zinc-800/60 pt-6">
            <TrackSourceIcon track={track} />
            {(track.primarySources || []).filter(source=>source.matchStatus==='CONFIRMED').map(source=><a key={source.id} href={source.canonicalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 underline"><TrackSourceIcon provider={source.provider}/>{source.provider.replace('_',' ')}</a>)}
            <Link to={`/external-music/${track.recordingId}`} className="text-sm underline">{t('externalMusic.sources')}</Link>
          </section>}
        </div>

        {hasDetailSidebar && (
          <div className="min-w-0 space-y-6 self-start xl:col-span-4">
            {/* Related tracks are a real secondary rail only when data exists. */}
            {relatedTracks.length > 0 && (
              <aside
                className="self-start border-t border-zinc-800/60 pt-6"
                data-testid="track-related-rail"
                aria-labelledby="track-related-title"
              >
                <h2 id="track-related-title" className="ns-section-title px-1">{isBeat ? t('beats.relatedBeats') : t('trackPage.relatedTracks')}</h2>
                <div className="mt-4 border-y border-zinc-800/60">
                  {relatedTracks.map((relTrack) => (
                    <Link
                      key={relTrack.id}
                      to={`/track/${relTrack.id}`}
                      className="group flex w-full cursor-pointer items-center gap-3 border-b border-zinc-900/70 p-3 text-left transition-colors last:border-b-0 hover:bg-zinc-900/40 focus:outline-none focus-visible:bg-zinc-900/50 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-red/40"
                    >
                      <FallbackCover
                        src={relTrack?.coverUrl}
                        title={relTrack?.title}
                        artistName={relTrack?.artistName}
                        genre={relTrack?.genre}
                        className="h-12 w-12 shrink-0 rounded border border-zinc-800"
                        imageClassName="object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-ns-body-sm font-semibold text-zinc-200 group-hover:text-[var(--ns-text-primary)]">
                          {relTrack.title}
                        </h3>
                        <p className="text-ns-meta text-zinc-500 mt-0.5 truncate">{relTrack.artistName}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </aside>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
