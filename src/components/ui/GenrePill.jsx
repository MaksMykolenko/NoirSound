import React from 'react';
import { Check } from 'lucide-react';
import { getLocalizedGenre } from '../../i18n/genreLabels';

export default function GenrePill({ genre, label, active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`ns-chip min-h-10 cursor-pointer border px-3.5 ${
        active
          ? 'border-brand-red/40 bg-brand-red text-[var(--ns-on-accent)]'
          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100'
      }`}
    >
      <span className="inline-flex items-center">
        <span className="ns-chip-check" aria-hidden="true">
          <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
        </span>
        <span>{label ?? getLocalizedGenre(genre)}</span>
      </span>
      {children}
    </button>
  );
}
