import React from 'react';
import { useTranslation } from 'react-i18next';
import { getBeatMetadata, isBeatTrack } from '../../utils/trackContent';

export function TrackTypeBadge({ track, className = '' }) {
  const { t } = useTranslation();
  if (!isBeatTrack(track)) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border border-brand-red/25 bg-brand-red/10 px-1.5 py-0.5 font-sans text-ns-micro font-semibold uppercase tracking-normal text-rose-300 ${className}`}
      data-testid="beat-badge"
    >
      {t('content.beat', { defaultValue: 'Beat' })}
    </span>
  );
}

export function BeatMetadataInline({ track, className = '', limit = 3 }) {
  const metadata = getBeatMetadata(track).slice(0, limit);
  if (metadata.length === 0) return null;

  const text = metadata.map((item) => item.key === 'bpm' ? `${item.value} ${item.label}` : item.value).join(' · ');
  return <span className={`ns-beat-meta ${className}`} title={text}>{text}</span>;
}
