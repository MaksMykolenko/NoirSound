import React from 'react';
import { ChevronRight, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getGenreLabel } from '../../utils/genreLabels';
import { QUICK_GROUP_LABELS } from '../../constants/musicGenres';

// Genre/group NAMES here are always English (see NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md)
// — only the surrounding chrome (heading, "More genres") is translated via i18n.
const HOME_GENRES = [
  { id: 'hip_hop', kind: 'genre', value: 'hip_hop' },
  { id: 'pop', kind: 'genre', value: 'pop' },
  { id: 'electronic', kind: 'genre', value: 'electronic' },
  { id: 'rock', kind: 'genre', value: 'rock' },
  { id: 'rnb', kind: 'genre', value: 'rnb' },
  { id: 'jazz', kind: 'genre', value: 'jazz' },
  { id: 'chill', kind: 'group', value: 'chill' },
  { id: 'world', kind: 'group', value: 'world' },
];

/** English-only display text for a HOME_GENRES entry (genre key or group key). */
function homeGenreLabel(item) {
  return item.kind === 'group' ? QUICK_GROUP_LABELS[item.value] : getGenreLabel(item.value);
}

export default function BrowseByGenre({ onSelect }) {
  const { t } = useTranslation();

  return (
    <section
      data-testid="home-genre-browser"
      className="flex flex-col gap-3 border-y border-zinc-800/60 py-4 xl:flex-row xl:items-center"
    >
      <div className="flex items-center gap-3 xl:w-64 xl:shrink-0">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-brand-red">
          <Tags size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100">{t('home.browseByGenre')}</h2>
          <p className="mt-0.5 text-ns-label text-zinc-500">{t('home.browseByGenreDesc')}</p>
        </div>
      </div>

      <div className="ns-tabs-scroll -mx-4 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0">
        {HOME_GENRES.map((item) => (
          <button
            key={item.id}
            type="button"
            data-genre-kind={item.kind}
            data-genre-value={item.value}
            onClick={() => onSelect(item)}
            className="min-h-9 cursor-pointer rounded border border-zinc-800/80 bg-zinc-950/65 px-2.5 py-1.5 text-ns-label font-medium text-zinc-300 transition-colors hover:border-brand-red/35 hover:bg-brand-red/5 hover:text-zinc-100 sm:min-h-10 sm:px-3"
          >
            {homeGenreLabel(item)}
          </button>
        ))}
        <button
          type="button"
          data-testid="home-more-genres"
          onClick={() => onSelect({ kind: 'more' })}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded border border-brand-red/25 bg-brand-red/5 px-2.5 py-1.5 text-ns-label font-semibold text-rose-300 transition-colors hover:border-brand-red/45 hover:bg-brand-red/10 sm:min-h-10 sm:px-3"
        >
          <span>{t('home.moreGenres')}</span>
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
