import React from 'react';
import { useTranslation } from 'react-i18next';
import { getBeatMetadata, isBeatTrack } from '../../utils/trackContent';

export function TrackTypeBadge({ track, className = '' }) {
  const { t } = useTranslation();
  if (!isBeatTrack(track)) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 font-mono text-xs font-semibold text-brand-red tracking-wide ${className}`}
      data-testid="beat-badge"
    >
      <span className="text-brand-red/60 font-bold" aria-hidden="true">#</span>
      <span>{t('content.beat', { defaultValue: 'Beat' })}</span>
    </span>
  );
}

export function BeatMetadataInline({ track, className = '', limit = 3 }) {
  const metadata = getBeatMetadata(track).slice(0, limit);
  if (metadata.length === 0) return null;

  const text = metadata.map((item) => item.key === 'bpm' ? `${item.value} ${item.label}` : item.value).join(' · ');
  return <span className={`ns-beat-meta ${className}`} title={text}>{text}</span>;
}
