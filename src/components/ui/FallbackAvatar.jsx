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

  const [base, accent, shadow] = visual.colors;
  return (
    <div
      role="img"
      aria-label={`Generated avatar for ${name || 'unknown artist'}`}
      data-visual-key={visual.key}
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{
        background: `linear-gradient(${visual.angle}deg, ${base}, ${accent}, ${shadow})`,
      }}
    >
      <span
        className="absolute w-3/4 aspect-square rounded-full border border-white/15 bg-white/5"
        style={{ transform: `translate(${visual.x - 44}%, ${visual.y - 44}%)` }}
      />
      <span className="relative text-[0.34em] font-black tracking-[-0.04em] text-white/95">
        {initialsFor(name, '?')}
      </span>
    </div>
  );
}
