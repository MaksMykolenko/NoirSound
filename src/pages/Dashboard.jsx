import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, PlusCircle, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getTracks } from '../api';
import { useUserStore } from '../store/userStore';
import StatsCard from '../components/dashboard/StatsCard';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import FallbackCover from '../components/ui/FallbackCover';
import { sortTracksNewest } from '../utils/presentation';
import { formatNumber } from '../utils/formatLocale';
import { getLocalizedGenre } from '../i18n/genreLabels';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, authHydrated, setAuthModalOpen } = useUserStore();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const canCreate = ['ARTIST', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    if (!authHydrated || !canCreate) return;
    setLoading(true);
    getTracks()
      .then((data) => {
        setTracks(sortTracksNewest(data));
        setError(null);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [authHydrated, canCreate]);

  const myTracks = useMemo(() => {
    if (!user?.artistProfileId) return [];
    return tracks.filter((track) => track.artistId === user.artistProfileId);
  }, [tracks, user?.artistProfileId]);

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

  const totalStreams = myTracks.reduce((sum, track) => sum + Number(track.plays || 0), 0);
  const totalLikes = myTracks.reduce((sum, track) => sum + Number(track.likes || 0), 0);

  return (
    <div className="ns-page-stack animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
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
      ) : myTracks.length === 0 ? (
        <EmptyState
          iconName="UploadCloud"
          title={t('dashboard.emptyState')}
          description="Only persisted, published releases and their backend metrics are shown."
          actionText={t('actions.uploadTrack')}
          onAction={() => navigate('/upload')}
        />
      ) : (
        <>
          <section className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-4">
            <StatsCard title={t('dashboard.totalStreams')} value={formatNumber(totalStreams)} iconName="Play" />
            <StatsCard title={t('dashboard.hearts')} value={formatNumber(totalLikes)} iconName="Heart" />
          </section>

          <section className="ns-state-panel !p-6">
            <h2 className="ns-eyebrow">{t('dashboard.analytics')}</h2>
            <p className="text-sm text-zinc-400 mt-2">
              Follower, monthly-listener, revenue, and time-series analytics are not available from the backend yet.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="ns-eyebrow px-1">Published Releases ({myTracks.length})</h2>
            <div className="ns-card p-2 sm:p-4 space-y-2">
              {myTracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => navigate(`/track/${track.id}`)}
                  className="w-full flex items-center justify-between p-2 hover:bg-zinc-900/40 rounded-xl text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FallbackCover
                      src={track.coverUrl}
                      title={track.title}
                      artistName={track.artistName}
                      genre={track.genre}
                      className="w-10 h-10 rounded-lg"
                      imageClassName="object-cover"
                    />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-200 truncate">{track.title}</h3>
                      <p className="text-xs text-zinc-500">{getLocalizedGenre(track.genre) || 'Uncategorized'}</p>
                    </div>
                  </div>
                  <Eye size={15} className="text-zinc-500" />
                </button>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <button onClick={() => navigate('/upload')} className="ns-button-secondary px-5 inline-flex items-center gap-2 cursor-pointer">
              <UploadCloud size={15} />
              <span>{t('dashboard.uploadNew')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
