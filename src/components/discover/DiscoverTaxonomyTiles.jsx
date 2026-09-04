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
            className={`ns-discover-taxonomy-tile ns-discover-taxonomy-tile--${(index % 4) + 1} ${active ? 'is-active' : ''}`}
          >
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold text-zinc-100">{item.label}</span>
              {item.count != null && (
                <span className="mt-1 block text-ns-meta tabular-nums text-zinc-500">
                  {item.countLabel || item.count}
                </span>
              )}
            </span>
            <ArrowUpRight size={16} className="shrink-0 text-zinc-600" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
