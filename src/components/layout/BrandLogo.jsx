import React from 'react';
import { NavLink } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';

export default function BrandLogo({ size = 'md', showSubtitle = true, onClick }) {
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  const containerClasses = size === 'sm'
    ? 'w-8 h-8 rounded-lg'
    : 'w-9 h-9 rounded-xl';

  const iconSize = size === 'sm' ? 16 : 18;

  return (
    <NavLink
      to="/"
      onClick={onClick}
      className="flex items-center space-x-3 px-2.5 py-1 rounded-xl hover:bg-zinc-900/40 transition-colors shrink-0 group"
    >
      <div
        className={`${containerClasses} bg-gradient-to-br from-brand-red to-rose-700 flex items-center justify-center transition-all duration-300 ${
          isPlaying
            ? 'shadow-[0_0_22px_var(--ns-accent-glow)] ring-2 ring-brand-red/60 animate-pulse'
            : 'shadow-[0_0_16px_var(--ns-accent-glow)]'
        }`}
      >
        {isPlaying ? (
          <div className="flex items-end justify-center space-x-0.5 h-4 w-4">
            <span className="w-1 bg-[var(--ns-on-accent)] rounded-full animate-eq-1 inline-block" />
            <span className="w-1 bg-[var(--ns-on-accent)] rounded-full animate-eq-2 inline-block" />
            <span className="w-1 bg-[var(--ns-on-accent)] rounded-full animate-eq-3 inline-block" />
          </div>
        ) : (
          <Radio className="text-[var(--ns-on-accent)] group-hover:scale-105 transition-transform duration-200" size={iconSize} />
        )}
      </div>

      <div>
        <div className="flex items-center space-x-1.5">
          <span className={`${size === 'sm' ? 'text-lg' : 'text-xl'} font-bold tracking-tight text-zinc-100 font-display`}>
            NoirSound
          </span>
          {isPlaying && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red"></span>
            </span>
          )}
        </div>
        {showSubtitle && (
          <span className="block text-[10px] tracking-[0.16em] text-zinc-500 uppercase font-bold">
            Creator First
          </span>
        )}
      </div>
    </NavLink>
  );
}
