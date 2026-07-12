import React from 'react';
import { NavLink } from 'react-router-dom';
import { usePlayerStore } from '../../store/playerStore';

export default function BrandLogo({ size = 'md', showSubtitle = false, onClick }) {
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  return (
    <NavLink
      to="/"
      onClick={onClick}
      className="group flex min-h-11 shrink-0 items-center gap-2 rounded-md px-2 transition-colors hover:bg-zinc-900/40"
      aria-label="NoirSound home"
    >
      <span
        className={`${size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} rounded-full bg-brand-red ${
          isPlaying ? 'animate-pulse' : ''
        }`}
        aria-hidden="true"
      />

      <div>
        <div className="flex items-center gap-1.5">
          <span className={`${size === 'sm' ? 'text-lg' : 'text-xl'} font-display font-bold tracking-tight text-white`}>
            NoirSound
          </span>
          {isPlaying && (
            <span className="flex h-1.5 w-3 items-end gap-px" aria-label="Playing">
              <span className="inline-block w-px bg-brand-red animate-eq-1" />
              <span className="inline-block w-px bg-brand-red animate-eq-2" />
              <span className="inline-block w-px bg-brand-red animate-eq-3" />
            </span>
          )}
        </div>
        {showSubtitle && (
          <span className="block font-mono text-[9px] uppercase tracking-wider text-zinc-500">
            Creator First
          </span>
        )}
      </div>
    </NavLink>
  );
}
