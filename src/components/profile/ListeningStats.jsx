import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Disc3, Music2, Play } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import LoadingState from '../ui/LoadingState';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import { formatNumber } from '../../utils/formatLocale';

export default function ListeningStats() {
  const { t } = useTranslation();
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
    <div className="space-y-8 animate-fade-in">
      <section className="grid grid-cols-1 min-[430px]:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="p-4 ns-card flex items-center gap-3 min-h-24">
            <div className="p-2.5 bg-zinc-950 border border-zinc-900 text-brand-red rounded-xl">
              <Icon size={16} />
            </div>
            <div>
              <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wide">{label}</span>
              <span className="block text-base font-extrabold text-zinc-100 mt-1">{value}</span>
            </div>
          </div>
        ))}
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
            <p className="text-xs text-zinc-500 mt-1">
              Based on {stats.tracksPlayed} playback {stats.tracksPlayed === 1 ? 'start' : 'starts'}; percentages are hidden until more history exists.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.topGenres.map((item) => (
              <div key={item.genre}>
                <div className="flex justify-between items-center gap-2 text-xs font-bold text-zinc-300 mb-1.5">
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
