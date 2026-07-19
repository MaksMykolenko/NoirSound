import React, { useEffect, useMemo, useState } from 'react';
import { deterministicVisual, initialsFor } from '../../utils/presentation';

export default function FallbackAvatar({
  src,
  name,
  className = '',
  imageClassName = '',
  semanticFallback = false,
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const visual = useMemo(() => deterministicVisual(name), [name]);
  const fallbackSurfaceClass = semanticFallback
    ? 'bg-[var(--ns-card-soft)]'
    : 'bg-zinc-900';
  const fallbackRingClass = semanticFallback
    ? 'border-[var(--ns-border)]'
    : 'border-white/8';
  const fallbackTextClass = semanticFallback
    ? 'text-[var(--ns-text)]'
    : 'text-white/95';

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name || 'Artist'}
        className={`${className} ${imageClassName}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Generated avatar for ${name || 'unknown artist'}`}
      data-visual-key={visual.key}
      className={`relative flex items-center justify-center overflow-hidden ${fallbackSurfaceClass} ${className}`}
    >
      <span
        className={`absolute aspect-square w-3/4 rounded-full border ${fallbackRingClass}`}
        style={{ transform: `translate(${visual.x - 44}%, ${visual.y - 44}%)` }}
      />
      <span className={`relative font-sans text-[0.34em] font-bold tracking-tight ${fallbackTextClass}`}>
        {initialsFor(name, '?')}
      </span>
    </div>
  );
}
