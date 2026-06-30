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

  const [base, accent, shadow] = visual.colors;
  return (
    <div
      role="img"
      aria-label={`Generated fallback cover for ${title || 'untitled track'}`}
      data-visual-key={visual.key}
      className={`relative overflow-hidden isolate bg-zinc-950 ${className}`}
      style={{
        background: `linear-gradient(${visual.angle}deg, ${base}, ${accent} 54%, ${shadow})`,
      }}
    >
      <span
        className="absolute w-[58%] aspect-square rounded-full border border-white/15 bg-white/5 blur-[1px]"
        style={{ left: `${visual.x - 28}%`, top: `${visual.y - 28}%` }}
      />
      <span
        className="absolute w-[68%] h-[18%] bg-black/20 border-y border-white/10"
        style={{
          right: '-18%',
          bottom: '17%',
          transform: `rotate(${visual.rotation}deg)`,
        }}
      />
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,0.18),transparent_34%)]" />
      <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
        <span className="text-lg sm:text-xl font-black tracking-[-0.05em] text-white/95">
          {initialsFor(title)}
        </span>
        <span className="text-[7px] sm:text-[8px] uppercase tracking-[0.18em] font-bold text-white/55">
          No artwork
        </span>
      </span>
    </div>
  );
}
