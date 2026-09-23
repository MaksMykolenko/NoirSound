import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Disc,
  Clock,
  Music2,
  Users,
  ChevronDown,
  ChevronUp,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import { formatNumber } from '../../utils/formatLocale';
import FallbackAvatar from '../ui/FallbackAvatar';

export default function SoundIdentityCard({
  stats = {},
  listeningTimeLabel = '0m',
  onOpenFullStats,
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Normalize genre percent/percentage
  const rawGenres = stats.topGenres || [];
  const totalTracks = stats.tracksPlayed || rawGenres.reduce((acc, g) => acc + (g.count || 0), 0) || 1;

  const genres = rawGenres.map((item) => {
    let percent = item.percentage ?? item.percent;
    if (percent === undefined || percent === null) {
      percent = item.count ? Math.round((item.count / totalTracks) * 100) : 0;
    }
    return {
      genre: item.genre,
      count: item.count || 0,
      percent: Number.isFinite(Number(percent)) ? Math.min(100, Math.max(0, Number(percent))) : 0,
    };
  });

  // Listening history is the only source for these metrics.
  const topArtists = Array.isArray(stats.topArtists) ? stats.topArtists : [];

  const visibleGenres = isExpanded ? genres : genres.slice(0, 3);
  const visibleArtists = isExpanded ? topArtists : topArtists.slice(0, 3);

  return (
    <div
      data-testid="sound-identity-card"
      className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/95 via-zinc-900/70 to-zinc-950 p-5 shadow-2xl backdrop-blur-xl transition-all duration-300"
    >
      {/* Background ambient lighting accent */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-brand-red/10 blur-3xl" />

      {/* Header: Title + Mode Switcher (Compact / Expanded) */}
      <div className="relative z-10 flex flex-wrap gap-3 items-center justify-between border-b border-zinc-800/70 pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-red/15 text-brand-red border border-brand-red/30 shadow-sm shadow-brand-red/20">
            <Sparkles size={14} className="fill-brand-red/40 text-brand-red" />
          </span>
          <div>
            <h3 className="text-xs font-bold tracking-wider text-zinc-100 uppercase font-mono flex items-center gap-1.5">
              <span>{t('redesign.soundIdentity')}</span>
              <span className="h-1 w-1 rounded-full bg-brand-red" />
            </h3>
            <span className="text-[10px] text-zinc-500 font-sans block">
              {t(isExpanded ? 'redesign.fullBreakdown' : 'redesign.listenerPreview')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Compact / Expanded Segmented Switcher */}
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950/80 p-0.5 shadow-inner">
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-pressed={!isExpanded}
              className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                !isExpanded
                  ? 'bg-zinc-800 text-[var(--ns-design-ink)] shadow-sm font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('redesign.compact')}
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              aria-pressed={isExpanded}
              className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-brand-red text-white shadow-sm font-medium shadow-brand-red/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('redesign.expanded')}
            </button>
          </div>

          {onOpenFullStats && (
            <button
              type="button"
              onClick={onOpenFullStats}
              className="text-[11px] font-semibold text-brand-red hover:text-rose-400 hover:underline transition-colors cursor-pointer pl-1"
              title={t('profile.stats')}
            >
              {t('profile.stats')} →
            </button>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid (4 Key Tiles) */}
      <div className="relative z-10 mt-4 grid grid-cols-2 gap-2.5">
        {/* Top Genre */}
        <div className="group rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/60">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{t('stats.topGenre')}</span>
            <Music2 size={12} className="text-zinc-500 group-hover:text-brand-red transition-colors" />
          </div>
          <span className="mt-1 text-sm font-bold text-zinc-100 block truncate">
            {stats.topGenre ? getLocalizedGenre(stats.topGenre) : t('stats.notEnoughData')}
          </span>
        </div>

        {/* Time Listened */}
        <div className="group rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/60">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{t('stats.timeListened')}</span>
            <Clock size={12} className="text-amber-500/80 group-hover:text-amber-400 transition-colors" />
          </div>
          <span className="mt-1 text-sm font-bold text-zinc-100 block truncate font-mono">
            {listeningTimeLabel || '0m'}
          </span>
        </div>

        {/* Tracks Played */}
        <div className="group rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/60">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{t('stats.playbackStarts')}</span>
            <Disc size={12} className="text-zinc-500 group-hover:text-brand-red transition-colors" />
          </div>
          <span className="mt-1 text-sm font-bold text-zinc-100 block font-mono">
            {formatNumber(stats.tracksPlayed || 0)}
          </span>
        </div>

        {/* Artists Heard */}
        <div className="group rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/60">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{t('stats.artistsDiscovered')}</span>
            <Users size={12} className="text-zinc-500 group-hover:text-brand-red transition-colors" />
          </div>
          <span className="mt-1 text-sm font-bold text-zinc-100 block font-mono">
            {formatNumber(stats.uniqueArtists ?? topArtists.length)}
          </span>
        </div>
      </div>

      {/* Genre Affinity Section */}
      {genres.length > 0 && (
        <div className="relative z-10 mt-5 border-t border-zinc-800/70 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <span>{t('stats.genreBreakdown')}</span>
              <span className="text-[10px] font-normal text-zinc-500 font-sans">
                ({t('redesign.genreCount', { count: genres.length })})
              </span>
            </span>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t(isExpanded ? 'redesign.less' : 'redesign.more')}</span>
              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>

          <div className="space-y-2.5">
            {visibleGenres.map((item, idx) => (
              <div key={item.genre} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-zinc-500 font-semibold w-3.5">
                      #{idx + 1}
                    </span>
                    <span className="truncate font-medium text-zinc-200">
                      {getLocalizedGenre(item.genre)}
                    </span>
                    {item.count > 0 && isExpanded && (
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        ({t('redesign.resultCount', { count: item.count })})
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-brand-red shrink-0 ml-2">
                    {item.percent}%
                  </span>
                </div>

                {/* Progress bar with smooth gradient and glow */}
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/60 p-[1px]">
                  <div
                    className="h-full bg-gradient-to-r from-brand-red via-rose-500 to-rose-400 rounded-full transition-all duration-500"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Artists Section */}
      {topArtists.length > 0 && (
        <div className="relative z-10 mt-5 border-t border-zinc-800/70 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Radio size={12} className="text-brand-red" />
              <span>{t('stats.topArtistsHeading')}</span>
              <span className="text-[10px] font-normal text-zinc-500 font-sans">
                ({topArtists.length})
              </span>
            </span>

            <span className="text-[10px] font-mono text-zinc-500">
              {t('trackPage.plays')}
            </span>
          </div>

          <div className={`space-y-2 ${isExpanded ? 'space-y-2.5' : ''}`}>
            {visibleArtists.map((artist, idx) => (
              <div
                key={artist.id || artist.name}
                className="flex items-center justify-between rounded-lg border border-zinc-800/50 bg-zinc-950/40 p-2 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/40"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-[10px] font-bold text-zinc-500 w-3.5 text-center">
                    {idx + 1}
                  </span>

                  <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-zinc-700/60">
                    <FallbackAvatar
                      src={artist.avatarUrl}
                      name={artist.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    {artist.id ? (
                      <Link
                        to={`/artist/${artist.id}`}
                        className="truncate text-xs font-semibold text-zinc-200 hover:text-white hover:underline flex items-center gap-1 group"
                      >
                        <span className="truncate">{artist.name}</span>
                        <ExternalLink size={9} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ) : (
                      <span className="truncate text-xs font-semibold text-zinc-200 block">
                        {artist.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right pl-2">
                  <span className="font-mono text-xs font-bold text-zinc-300 block">
                    {formatNumber(artist.playCount ?? artist.plays ?? 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Only: Sonic Vibe Signature */}
      {isExpanded && stats.topGenre && (
        <div className="relative z-10 mt-5 rounded-xl border border-rose-950/60 bg-rose-950/20 p-3 text-xs text-zinc-400 space-y-1">
          <div className="flex items-center gap-1.5 text-brand-red font-mono text-[11px] font-semibold uppercase">
            <Sparkles size={11} />
            <span>{t('redesign.sonicProfile')}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-300">
            {t('redesign.sonicSummary', { genre: getLocalizedGenre(stats.topGenre) })}
          </p>
        </div>
      )}
    </div>
  );
}
