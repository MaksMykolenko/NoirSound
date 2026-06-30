import React from 'react';
import { getLocalizedGenre } from '../../i18n/genreLabels';

export default function GenrePill({ genre, label, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 px-4 sm:px-5 py-2.5 rounded-full text-[13px] sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
        active
          ? 'bg-brand-red text-[var(--ns-on-accent)] border border-brand-red shadow-[0_0_18px_var(--ns-accent-glow)]'
          : 'bg-brand-graphite text-zinc-400 hover:text-zinc-100 hover:bg-brand-gray border border-zinc-800/70 hover:border-zinc-700'
      }`}
    >
      {label ?? getLocalizedGenre(genre)}
      {children}
    </button>
  );
}
