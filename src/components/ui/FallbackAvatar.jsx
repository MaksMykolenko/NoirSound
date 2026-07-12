import React, { useEffect, useMemo, useState } from 'react';
import { deterministicVisual, initialsFor } from '../../utils/presentation';

export default function FallbackAvatar({
  src,
  name,
  className = '',
  imageClassName = '',
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const visual = useMemo(() => deterministicVisual(name), [name]);

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
      className={`relative flex items-center justify-center overflow-hidden bg-zinc-900 ${className}`}
    >
      <span
        className="absolute aspect-square w-3/4 rounded-full border border-white/8"
        style={{ transform: `translate(${visual.x - 44}%, ${visual.y - 44}%)` }}
      />
      <span className="relative font-display text-[0.34em] font-bold tracking-tight text-white/95">
        {initialsFor(name, '?')}
      </span>
    </div>
  );
}
