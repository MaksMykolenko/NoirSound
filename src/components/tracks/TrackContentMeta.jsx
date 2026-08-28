import React from 'react';
import { useTranslation } from 'react-i18next';
import { getBeatMetadata, isBeatTrack } from '../../utils/trackContent';

export function TrackTypeBadge({ track, className = '' }) {
  const { t } = useTranslation();
  if (!isBeatTrack(track)) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border border-brand-red/25 bg-brand-red/10 px-1.5 py-0.5 font-sans text-ns-meta font-semibold uppercase tracking-ns-label text-rose-300 ${className}`}
      data-testid="beat-badge"
    >
      {t('content.beat', { defaultValue: 'Beat' })}
    </span>
  );
}

export function BeatMetadataInline({ track, className = '', limit = 3 }) {
  const metadata = getBeatMetadata(track).slice(0, limit);
  if (metadata.length === 0) return null;

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 font-sans tabular-nums text-ns-meta text-zinc-500 ${className}`}>
      {metadata.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 && <span aria-hidden="true" className="text-zinc-700">·</span>}
          <span className="truncate">{item.key === 'bpm' ? `${item.value} ${item.label}` : item.value}</span>
        </React.Fragment>
      ))}
    </span>
  );
}
