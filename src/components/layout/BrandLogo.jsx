import React from 'react';
import { NavLink } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';

export default function BrandLogo({ size = 'md', showSubtitle = true, onClick }) {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const hasTrack = usePlayerStore((state) => Boolean(state.currentTrack));
  const isCompact = size === 'sm';

  return (
    <NavLink
      to="/"
      onClick={onClick}
      className={`group flex min-h-11 shrink-0 items-center rounded-md transition-colors hover:bg-zinc-900/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/45 ${
        isCompact ? 'gap-2 px-1.5 py-1' : 'w-full gap-3 border-b border-zinc-800/70 px-2.5 py-2.5'
      }`}
      aria-label="NoirSound home"
    >
      <span className={`flex shrink-0 items-center justify-center rounded-md border border-brand-red/35 bg-brand-red/10 text-brand-red ${isCompact ? 'h-8 w-8' : 'h-10 w-10'}`} aria-hidden="true">
        {hasTrack ? (
          <span className={`flex items-end justify-center gap-[3px] ${isCompact ? 'h-3.5 w-4' : 'h-4 w-5'}`}>
            <span className={`inline-block w-[3px] rounded-sm bg-current ${isPlaying ? 'animate-eq-1' : 'h-[35%]'}`} />
            <span className={`inline-block w-[3px] rounded-sm bg-current ${isPlaying ? 'animate-eq-2' : 'h-[85%]'}`} />
            <span className={`inline-block w-[3px] rounded-sm bg-current ${isPlaying ? 'animate-eq-3' : 'h-[45%]'}`} />
          </span>
        ) : (
          <Radio size={isCompact ? 16 : 18} className="transition-transform duration-200 group-hover:scale-105" />
        )}
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`${isCompact ? 'text-lg' : 'text-xl'} truncate font-sans font-bold tracking-tight text-white`}>
            NoirSound
          </span>
          {isPlaying && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" aria-hidden="true" />}
        </div>
        {showSubtitle && (
          <span className="block truncate font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">
            Creator First
          </span>
        )}
        {hasTrack && <span className="sr-only">{isPlaying ? 'Music playing' : 'Music paused'}</span>}
      </div>
    </NavLink>
  );
}
