import React from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const QUICK_VIBES = [
  { id: 'night-drive', label: 'Night Drive', icon: '🏎️', genre: 'synthwave', bpm: '120-149' },
  { id: 'heavy-trap', label: 'Heavy Trap', icon: '⚡', genre: 'trap', bpm: '120-149' },
  { id: 'lofi-focus', label: 'Lo-Fi Chill', icon: '☕', genre: 'lofi', bpm: 'under-90' },
  { id: 'cyber-phonk', label: 'Cyber Phonk', icon: '🪐', genre: 'phonk', bpm: '150-plus' },
  { id: 'melodic-drill', label: 'Melodic Drill', icon: '🔥', genre: 'drill', bpm: '120-149' },
  { id: 'deep-ambient', label: 'Deep Space', icon: '🌌', genre: 'ambient', bpm: 'under-90' },
];

export default function DiscoverVibeBar({
  searchDraft = '',
  onSearchChange,
  onSearchSubmit,
  searchRef,
  activeVibe,
  onSelectVibe,
  totalResults,
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3.5">
      {/* Search Input Bar with embedded controls */}
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); onSearchSubmit?.(); }}
        className="relative flex items-center"
      >
        <div className="pointer-events-none absolute left-4 text-zinc-500 flex items-center">
          <Search size={18} />
        </div>
        <input
          aria-label={t('discover.searchLabel')}
          ref={searchRef}
          id="discover-search"
          data-testid="discover-search"
          type="search"
          maxLength={120}
          value={searchDraft}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={t('header.searchPlaceholder') || 'Search tracks, artists, beats, vibes...'}
          className="w-full rounded-xl border border-zinc-800/90 bg-zinc-950/80 py-3.5 pl-12 pr-28 text-sm text-zinc-100 placeholder-zinc-500 shadow-inner backdrop-blur-md transition-all focus:border-brand-red/60 focus:bg-zinc-900/90 focus:outline-none focus:ring-1 focus:ring-brand-red/50"
        />

        <div className="absolute right-3 flex items-center gap-1.5">
          {searchDraft && (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label={t('redesign.clearSearch')}
            >
              <X size={15} />
            </button>
          )}

          {totalResults != null && (
            <span className="hidden sm:inline-flex items-center rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] font-mono tabular-nums text-zinc-400">
              {t('redesign.resultCount', { count: totalResults })}
            </span>
          )}
        </div>
      </form>

      {/* Quick Vibe Presets Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
        <span className="shrink-0 font-semibold text-zinc-500 uppercase tracking-wider text-[10px] pl-1 pr-1">
          {t('redesign.quickVibes')}
        </span>

        {QUICK_VIBES.map((vibe) => {
          const isActive = activeVibe === vibe.id;
          return (
            <button
              key={vibe.id}
              type="button"
              onClick={() => onSelectVibe?.(isActive ? null : vibe)}
              aria-pressed={isActive}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'border border-brand-red bg-brand-red/20 text-white shadow-sm shadow-brand-red/30 scale-105'
                  : 'border border-zinc-800/80 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/80 hover:text-zinc-200'
              }`}
            >
              <span aria-hidden="true">{vibe.icon}</span>
              <span>{t(`redesign.vibes.${vibe.id}`, vibe.label)}</span>
              {isActive && (
                <X size={12} className="ml-0.5 text-brand-red hover:text-white" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
