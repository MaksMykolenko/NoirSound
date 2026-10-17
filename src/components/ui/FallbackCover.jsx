import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deterministicVisual, initialsFor } from '../../utils/presentation';

export default function FallbackCover({
  src,
  title,
  artistName,
  genre,
  className = '',
  imageClassName = '',
  loading = 'lazy',
}) {
  const { t } = useTranslation();
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
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={t('media.noArtwork', { title: title || t('media.untitled') })}
      data-visual-key={visual.key}
      className={`ns-cover-fallback relative overflow-hidden ${className}`}
      // Stable per-release tint so a row of missing artwork does not read as unloaded.
      style={{ '--ns-cover-tint': `${6 + (visual.x % 12)}%` }}
    >
      <span aria-hidden="true" className="ns-cover-fallback__initials">
        {initialsFor(title)}
      </span>
    </div>
  );
}
