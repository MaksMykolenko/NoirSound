import React from 'react';
import { getLocalizedGenre } from '../../i18n/genreLabels';

export default function GenrePill({ genre, label, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded border px-3.5 py-2 text-xs font-medium transition-colors duration-150 ${
        active
          ? 'border-brand-red/40 bg-brand-red text-[var(--ns-on-accent)]'
          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100'
      }`}
    >
      {label ?? getLocalizedGenre(genre)}
      {children}
    </button>
  );
}
