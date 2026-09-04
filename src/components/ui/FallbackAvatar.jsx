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
  const fallbackTextClass = semanticFallback
    ? 'text-[var(--ns-text)]'
    : 'text-[var(--ns-text-primary)]';

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name || 'Artist'}
        className={`ns-avatar ${className} ${imageClassName}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Generated avatar for ${name || 'unknown artist'}`}
      data-visual-key={visual.key}
      style={{ containerType: 'inline-size' }}
      className={`ns-avatar relative flex items-center justify-center ${fallbackSurfaceClass} ${className}`}
    >
      <span className={`font-sans text-[clamp(.625rem,30cqw,3rem)] font-semibold tracking-tight ${fallbackTextClass}`}>
        {initialsFor(name, '?')}
      </span>
    </div>
  );
}
