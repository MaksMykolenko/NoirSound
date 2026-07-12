import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Clock, Disc3, Music2, Play } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import LoadingState from '../ui/LoadingState';
import FallbackCover from '../ui/FallbackCover';
import FallbackAvatar from '../ui/FallbackAvatar';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import { formatNumber } from '../../utils/formatLocale';

export default function ListeningStats() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    userListeningStats,
    listeningStatsHydrated,
    listeningStatsError,
    fetchListeningStats,
  } = useUserStore();

  useEffect(() => {
    if (!listeningStatsHydrated) {
      fetchListeningStats().catch(() => {});
    }
  }, [fetchListeningStats, listeningStatsHydrated]);

  if (!listeningStatsHydrated) return <LoadingState type="list" count={4} />;
  if (listeningStatsError) {
    return <ErrorState title="Listening stats unavailable" message={listeningStatsError} />;
  }

  const stats = userListeningStats;
  const measuredSeconds = Number(
    stats.totalListeningSeconds ?? (stats.totalListeningMinutes || 0) * 60
  );
  const hasData = measuredSeconds > 0 || stats.tracksPlayed > 0;
  if (!hasData) {
    return (
      <EmptyState
        iconName="Headphones"
        title={t('stats.notEnoughData')}
        description={t('stats.notEnoughDataDesc')}
      />
    );
  }

  const listeningTime = measuredSeconds <= 0
    ? t('stats.noListeningTime')
    : measuredSeconds < 60
      ? `${measuredSeconds}s`
      : measuredSeconds < 3600
        ? `${Math.floor(measuredSeconds / 60)}m`
        : `${Math.floor(measuredSeconds / 3600)}h ${Math.floor((measuredSeconds % 3600) / 60)}m`;
  const lowGenreConfidence = stats.tracksPlayed < 3;

  const metrics = [
    {
      label: t('stats.timeListened'),
      value: listeningTime,
      icon: Clock,
    },
    { label: t('stats.playbackStarts'), value: formatNumber(stats.tracksPlayed), icon: Play },
    { label: t('stats.artistsDiscovered'), value: formatNumber(stats.uniqueArtists), icon: Disc3 },
    { label: t('stats.topGenre'), value: stats.topGenre ? getLocalizedGenre(stats.topGenre) : t('stats.notEnoughData'), icon: Music2 },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 min-[430px]:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-h-20 items-center gap-3 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-4">
            <div className="rounded border border-zinc-800 bg-zinc-950 p-2 text-brand-red">
              <Icon size={16} />
            </div>
            <div>
              <span className="block font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">{label}</span>
              <span className="mt-1 block text-base font-semibold text-zinc-100">{value}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 sm:p-6 ns-card space-y-3">
          <h3 className="ns-eyebrow">{t('stats.topTracksHeading')}</h3>
          {stats.topTracks.length === 0 ? (
            <p className="text-sm text-zinc-500">{t('stats.notEnoughData')}</p>
          ) : (
            <div className="space-y-1">
              {stats.topTracks.slice(0, 5).map(({ track, playCount }) => (
                <button
                  key={track.id}
                  onClick={() => navigate(`/track/${track.id}`)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-md border border-transparent p-2 text-left transition-colors hover:border-zinc-800/60 hover:bg-zinc-900/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FallbackCover
                      src={track.coverUrl}
                      title={track.title}
                      genre={track.genre}
                      className="h-9 w-9 shrink-0 rounded"
                      imageClassName="object-cover"
                    />
                    <div className="min-w-0">
                      <h4 className="truncate text-ns-body-sm font-semibold text-zinc-200">{track.title}</h4>
                      <p className="truncate font-sans tabular-nums text-ns-meta text-zinc-500">{getLocalizedGenre(track.genre) || 'Uncategorized'}</p>
                    </div>
                  </div>
                  <span className="text-ns-meta text-zinc-500 font-semibold shrink-0">
                    {formatNumber(playCount)} {t('trackPage.plays')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 ns-card space-y-3">
          <h3 className="ns-eyebrow">{t('stats.topArtistsHeading')}</h3>
          {stats.topArtists.length === 0 ? (
            <p className="text-sm text-zinc-500">{t('stats.notEnoughData')}</p>
          ) : (
            <div className="space-y-1">
              {stats.topArtists.slice(0, 5).map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => navigate(`/artist/${artist.id}`)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-md border border-transparent p-2 text-left transition-colors hover:border-zinc-800/60 hover:bg-zinc-900/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FallbackAvatar
                      src={artist.avatarUrl}
                      name={artist.name}
                      className="w-9 h-9 rounded-full shrink-0"
                      imageClassName="object-cover"
                    />
                    <h4 className="truncate text-ns-body-sm font-semibold text-zinc-200">{artist.name}</h4>
                  </div>
                  <span className="text-ns-meta text-zinc-500 font-semibold shrink-0">
                    {formatNumber(artist.playCount)} {t('trackPage.plays')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="p-5 sm:p-6 ns-card space-y-5">
        <div>
          <h3 className="ns-eyebrow">{t('stats.genreBreakdown')}</h3>
          <p className="text-sm text-zinc-400 mt-1">{t('stats.calculatedFromEvents')}</p>
        </div>
        {stats.topGenres.length === 0 ? (
          <p className="text-sm text-zinc-500">{t('stats.notEnoughData')}</p>
        ) : lowGenreConfidence ? (
          <div className="ns-state-panel !p-4">
            <p className="text-sm text-zinc-300">
              Early signal: {stats.topGenres.map((item) => getLocalizedGenre(item.genre)).join(', ')}
            </p>
            <p className="text-ns-label text-zinc-500 mt-1">
              Based on {stats.tracksPlayed} playback {stats.tracksPlayed === 1 ? 'start' : 'starts'}; percentages are hidden until more history exists.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.topGenres.map((item) => (
              <div key={item.genre}>
                <div className="flex justify-between items-center gap-2 text-sm font-bold text-zinc-300 mb-1.5">
                  <span className="truncate min-w-0">{getLocalizedGenre(item.genre)}</span>
                  <span className="text-brand-red shrink-0">{item.percent}%</span>
                </div>
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-red" style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
