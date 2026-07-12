import React, { useEffect, useMemo, useState } from 'react';
import { deterministicVisual, initialsFor } from '../../utils/presentation';

export default function FallbackCover({
  src,
  title,
  artistName,
  genre,
  className = '',
  imageClassName = '',
  loading,
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const visual = useMemo(
    () => deterministicVisual(`${genre}|${title}|${artistName}`),
    [artistName, genre, title]
  );

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={title || 'Track artwork'}
        className={`${className} ${imageClassName}`}
        loading={loading}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Generated fallback cover for ${title || 'untitled track'}`}
      data-visual-key={visual.key}
      className={`relative isolate overflow-hidden bg-zinc-900 ${className}`}
    >
      <span
        className="absolute aspect-square w-[58%] rounded-full border border-white/8"
        style={{ left: `${visual.x - 28}%`, top: `${visual.y - 28}%` }}
      />
      <span
        className="absolute h-1.5 w-1.5 rounded-full bg-brand-red"
        style={{ left: `${visual.x}%`, top: `${visual.y}%` }}
      />
      <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
        <span className="font-display text-lg font-bold tracking-tight text-white/95 sm:text-xl">
          {initialsFor(title)}
        </span>
        <span className="font-mono text-[7px] font-medium uppercase tracking-wider text-white/55 sm:text-[8px]">
          No artwork
        </span>
      </span>
    </div>
  );
}
