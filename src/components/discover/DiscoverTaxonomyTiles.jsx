import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function DiscoverTaxonomyTiles({
  items = [],
  activeValue = '',
  onSelect,
  ariaLabel,
  variant = 'genre',
}) {
  return (
    <div className={`ns-discover-taxonomy-grid ns-discover-taxonomy-grid--${variant}`} aria-label={ariaLabel}>
      {items.map((item, index) => {
        const active = String(item.value).toLowerCase() === String(activeValue).toLowerCase();
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect?.(active ? '' : item.value)}
            className={`ns-discover-taxonomy-tile ns-discover-taxonomy-tile--${(index % 4) + 1} ${
              active ? 'is-active ring-1 ring-brand-red ' : ''
            } relative overflow-hidden transition-all duration-200 hover:scale-[1.02] cursor-pointer`}
          >
            {/* Ambient soundwave SVG in background */}
            <svg
              className="pointer-events-none absolute -bottom-2 -right-2 h-16 w-28 opacity-10 transition-opacity duration-300 group-hover:opacity-25"
              viewBox="0 0 100 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="5" y1="20" x2="5" y2="35" />
              <line x1="15" y1="12" x2="15" y2="38" />
              <line x1="25" y1="8" x2="25" y2="32" />
              <line x1="35" y1="4" x2="35" y2="39" />
              <line x1="45" y1="15" x2="45" y2="36" />
              <line x1="55" y1="6" x2="55" y2="34" />
              <line x1="65" y1="18" x2="65" y2="38" />
              <line x1="75" y1="10" x2="75" y2="35" />
              <line x1="85" y1="22" x2="85" y2="33" />
              <line x1="95" y1="16" x2="95" y2="37" />
            </svg>

            <span className="min-w-0 z-10">
              <span className="block break-words text-sm font-semibold text-zinc-100">{item.label}</span>
              {item.count != null && (
                <span className="mt-1 block text-ns-meta tabular-nums text-zinc-400 font-mono">
                  {item.countLabel || item.count}
                </span>
              )}
            </span>
            <ArrowUpRight
              size={16}
              className={`shrink-0 transition-transform duration-200 z-10 ${
                active ? 'text-brand-red rotate-45' : 'text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
              }`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
