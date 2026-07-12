import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, FileText, PlusCircle, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getArtistDashboard } from '../api';
import { useUserStore } from '../store/userStore';
import StatsCard from '../components/dashboard/StatsCard';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import FallbackCover from '../components/ui/FallbackCover';
import { formatNumber } from '../utils/formatLocale';
import { getLocalizedGenre } from '../i18n/genreLabels';
import LyricsEditModal from '../components/lyrics/LyricsEditModal';

const FAILED_STATUS_TONE = 'text-rose-300 bg-rose-500/10 border-rose-500/25';
const STATUS_TONES = {
  PUBLISHED: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  PROCESSING: 'text-sky-300 bg-sky-500/10 border-sky-500/25',
  PENDING_REVIEW: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  DRAFT: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/25',
  HIDDEN: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/25',
  FAILED: FAILED_STATUS_TONE,
  REJECTED: FAILED_STATUS_TONE,
};

function TrackStatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label ${STATUS_TONES[status] || 'text-zinc-400 bg-zinc-500/10 border-zinc-500/25'}`}>
      {status}
    </span>
  );
}

function TrackRow({ track, onOpen, onEditLyrics, trailing }) {
  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2.5 transition-colors hover:bg-zinc-900/35 sm:px-2">
      <button onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left cursor-pointer">
          <FallbackCover
            src={track.coverUrl}
            title={track.title}
            genre={track.genre}
            className="h-10 w-10 rounded"
            imageClassName="object-cover"
          />
          <div className="min-w-0 flex-1">
            <h3 className="flex min-w-0 items-center gap-1.5 text-ns-body-sm font-semibold text-zinc-200">
              <span className="truncate">{track.title}</span>
              {track.hasLyrics && <FileText size={12} className="shrink-0 text-brand-red" />}
            </h3>
            <p className="font-sans tabular-nums text-ns-meta text-zinc-500">{getLocalizedGenre(track.genre) || 'Uncategorized'}</p>
          </div>
      </button>
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onEditLyrics(track)}
          className="ns-icon-button"
          aria-label={`Edit lyrics for ${track.title}`}
        >
          <FileText size={14} />
        </button>
        <div className="max-w-28 truncate sm:max-w-none">{trailing}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, authHydrated, setAuthModalOpen } = useUserStore();
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lyricsTrack, setLyricsTrack] = useState(null);
  const canCreate = ['ARTIST', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    if (!authHydrated || !canCreate) return;
    setLoading(true);
    getArtistDashboard()
      .then((dashboardData) => {
        setDashboardStats(dashboardData);
        setError(null);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [authHydrated, canCreate]);

  if (!authHydrated) return <LoadingState type="list" count={4} />;
  if (!user) {
    return (
      <EmptyState
        iconName="LayoutDashboard"
        title={t('empty.signInTitle')}
        description={t('empty.signInDesc')}
        actionText={t('header.signIn')}
        onAction={() => setAuthModalOpen(true)}
      />
    );
  }
  if (!canCreate) {
    return (
      <EmptyState
        iconName="ShieldX"
        title="Creator access required"
        description="Your listener account cannot access uploads or creator analytics."
        actionText="Return Home"
        onAction={() => navigate('/')}
      />
    );
  }
  if (error) return <ErrorState title="Creator dashboard unavailable" message={error} />;

  // Every figure below is sourced from GET /me/artist-dashboard, which reads
  // this artist's own tracks directly by artistId (uncapped). It never
  // depends on the public, 20-item-capped, globally-ordered GET /tracks
  // feed -- that feed can silently omit an artist's own older releases once
  // enough other artists have published more recently, which would make
  // these dashboard counters quietly diverge from the database.
  const tracks = dashboardStats?.tracks || [];
  const publishedTracks = tracks.filter((track) => track.status === 'PUBLISHED');
  const totalStreams = dashboardStats?.totalPlays || 0;
  const totalLikes = dashboardStats?.totalLikes || 0;
  const followers = dashboardStats?.followers || 0;
  const monthlyListeners = dashboardStats?.monthlyListeners || 0;
  const topTracks = dashboardStats?.topTracks || [];
  const recentUploads = dashboardStats?.recentUploads || [];
  const failedUploads = dashboardStats?.failedUploads || [];

  const handleLyricsSaved = (result) => {
    const updateTrack = (track) => track.id === result.id
      ? { ...track, hasLyrics: result.hasLyrics, lyricsType: result.lyricsType }
      : track;
    setDashboardStats((current) => current ? {
      ...current,
      tracks: (current.tracks || []).map(updateTrack),
      topTracks: (current.topTracks || []).map(updateTrack),
      recentUploads: (current.recentUploads || []).map(updateTrack),
      failedUploads: (current.failedUploads || []).map(updateTrack),
    } : current);
  };

  return (
    <div className="ns-page-stack pb-10">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800/60 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="ns-page-title">{t('dashboard.title')}</h1>
          <p className="ns-page-lede">{t('dashboard.subtitle')}</p>
        </div>
        <button onClick={() => navigate('/upload')} className="ns-button-primary px-5 inline-flex items-center gap-2 w-fit">
          <PlusCircle size={16} />
          <span>{t('dashboard.uploadNew')}</span>
        </button>
      </div>

      {loading ? (
        <LoadingState type="list" count={4} />
      ) : tracks.length === 0 ? (
        <section className="mx-auto flex max-w-2xl flex-col items-center py-8 text-center sm:py-12" aria-labelledby="dashboard-empty-title">
          <UploadCloud className="mb-3 h-7 w-7 text-brand-red" aria-hidden="true" />
          <h2 id="dashboard-empty-title" className="ns-section-title">{t('dashboard.emptyState')}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">{t('dashboard.emptyDescription')}</p>
        </section>
      ) : (
        <>
          <section aria-label={t('dashboard.title')} className="grid grid-cols-1 divide-y divide-zinc-800/70 border-y border-zinc-800/70 min-[430px]:grid-cols-2 min-[430px]:divide-x min-[430px]:divide-y-0 lg:grid-cols-4">
            <StatsCard title={t('dashboard.totalStreams')} value={formatNumber(totalStreams)} iconName="Play" />
            <StatsCard title={t('dashboard.hearts')} value={formatNumber(totalLikes)} iconName="Heart" />
            <StatsCard title={t('dashboard.followers')} value={formatNumber(followers)} iconName="Users" />
            <StatsCard title={t('dashboard.monthlyListeners')} value={formatNumber(monthlyListeners)} iconName="Radio" />
          </section>

          <div className="grid gap-8 xl:grid-cols-2">
          <section className="space-y-3">
            <h2 className="ns-section-title">{t('dashboard.topTracks')}</h2>
            <div className="divide-y divide-zinc-800/60 border-y border-zinc-800/70">
              {topTracks.length === 0 ? (
                <p className="text-sm text-zinc-500 p-2">{t('dashboard.noTopTracksYet')}</p>
              ) : (
                topTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    onOpen={() => navigate(`/track/${track.id}`)}
                    onEditLyrics={setLyricsTrack}
                    trailing={
                      <span className="text-ns-meta text-zinc-500 font-semibold shrink-0">
                        {formatNumber(track.plays)} {t('trackPage.plays')}
                      </span>
                    }
                  />
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="ns-section-title">Published Releases ({publishedTracks.length})</h2>
            <div className="divide-y divide-zinc-800/60 border-y border-zinc-800/70">
              {publishedTracks.length === 0 ? (
                <p className="text-sm text-zinc-500 p-2">{t('empty.noReleasesYet')}</p>
              ) : (
                publishedTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    onOpen={() => navigate(`/track/${track.id}`)}
                    onEditLyrics={setLyricsTrack}
                    trailing={<Eye size={15} className="text-zinc-500 shrink-0" />}
                  />
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="ns-section-title">{t('dashboard.recentUploads')}</h2>
            <div className="divide-y divide-zinc-800/60 border-y border-zinc-800/70">
              {recentUploads.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  onOpen={() => navigate(`/track/${track.id}`)}
                  onEditLyrics={setLyricsTrack}
                  trailing={<TrackStatusBadge status={track.status} />}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="ns-section-title">{t('dashboard.failedUploads')}</h2>
            <div className="divide-y divide-zinc-800/60 border-y border-zinc-800/70">
              {failedUploads.length === 0 ? (
                <p className="text-sm text-zinc-500 p-2">{t('dashboard.noFailedUploads')}</p>
              ) : (
                failedUploads.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    onOpen={() => navigate(`/track/${track.id}`)}
                    onEditLyrics={setLyricsTrack}
                    trailing={<TrackStatusBadge status={track.status} />}
                  />
                ))
              )}
            </div>
          </section>
          </div>

          <section className="grid grid-cols-1 divide-y divide-zinc-800/70 border-y border-zinc-800/70 md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-5 sm:p-6">
              <h2 className="ns-eyebrow">{t('dashboard.geographyTitle')}</h2>
              <p className="text-sm text-zinc-400 mt-2">{t('dashboard.geographyUnavailable')}</p>
            </div>
            <div className="p-5 sm:p-6">
              <h2 className="ns-eyebrow">{t('dashboard.trendsTitle')}</h2>
              <p className="text-sm text-zinc-400 mt-2">{t('dashboard.trendsUnavailable')}</p>
            </div>
          </section>

          <div className="flex justify-end">
            <button onClick={() => navigate('/upload')} className="ns-button-secondary px-5 inline-flex items-center gap-2 cursor-pointer">
              <UploadCloud size={15} />
              <span>{t('dashboard.uploadNew')}</span>
            </button>
          </div>
          <LyricsEditModal
            open={Boolean(lyricsTrack)}
            track={lyricsTrack}
            onClose={() => setLyricsTrack(null)}
            onSaved={handleLyricsSaved}
          />
        </>
      )}
    </div>
  );
}
