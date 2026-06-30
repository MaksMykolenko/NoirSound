import React from 'react';
import { ChevronRight, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const HOME_GENRES = [
  { id: 'hip_hop', kind: 'genre', value: 'hip_hop', labelKey: 'genres.hip_hop' },
  { id: 'pop', kind: 'genre', value: 'pop', labelKey: 'genres.pop' },
  { id: 'electronic', kind: 'genre', value: 'electronic', labelKey: 'genres.electronic' },
  { id: 'rock', kind: 'genre', value: 'rock', labelKey: 'genres.rock' },
  { id: 'rnb', kind: 'genre', value: 'rnb', labelKey: 'genres.rnb' },
  { id: 'jazz', kind: 'genre', value: 'jazz', labelKey: 'genres.jazz' },
  { id: 'chill', kind: 'group', value: 'chill', labelKey: 'discover.tabs.chill' },
  { id: 'world', kind: 'group', value: 'world', labelKey: 'discover.tabs.world' },
];

export default function BrowseByGenre({ onSelect }) {
  const { t } = useTranslation();

  return (
    <section
      data-testid="home-genre-browser"
      className="ns-card p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center gap-3 sm:gap-4"
    >
      <div className="flex items-center gap-3 xl:w-64 xl:shrink-0">
        <span className="w-10 h-10 rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red flex items-center justify-center shrink-0">
          <Tags size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-zinc-100">{t('home.browseByGenre')}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{t('home.browseByGenreDesc')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
        {HOME_GENRES.map((item) => (
          <button
            key={item.id}
            type="button"
            data-genre-kind={item.kind}
            data-genre-value={item.value}
            onClick={() => onSelect(item)}
            className="min-h-9 sm:min-h-10 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full border border-zinc-800/80 bg-zinc-950/65 text-[11px] sm:text-xs font-semibold text-zinc-300 hover:text-zinc-100 hover:border-brand-red/35 hover:bg-brand-red/8 transition-all cursor-pointer"
          >
            {t(item.labelKey)}
          </button>
        ))}
        <button
          type="button"
          data-testid="home-more-genres"
          onClick={() => onSelect({ kind: 'more' })}
          className="min-h-9 sm:min-h-10 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full border border-brand-red/25 bg-brand-red/8 text-[11px] sm:text-xs font-bold text-rose-300 hover:bg-brand-red/15 hover:border-brand-red/45 transition-all cursor-pointer inline-flex items-center gap-1 sm:gap-1.5"
        >
          <span>{t('home.moreGenres')}</span>
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
