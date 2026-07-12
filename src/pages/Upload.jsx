import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers3, Music2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import UploadForm from '../components/upload/UploadForm';

export default function Upload() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl animate-fade-in space-y-6 [&_.ns-button-primary]:!rounded [&_.ns-button-secondary]:!rounded [&_.ns-field]:!rounded [&_.ns-icon-button]:!rounded">
      {/* Title */}
      <div className="space-y-2 border-b border-zinc-800/80 pb-5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-brand-red">Creator release flow</span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-100">{t('nav.upload')}</h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          Send your original release through NoirSound’s private processing pipeline.
        </p>
      </div>

      <div className="mx-auto grid max-w-3xl grid-cols-2 border border-zinc-800 bg-surface-noir/50 p-1">
        <span className="flex min-h-11 items-center justify-center gap-2 rounded bg-brand-red text-xs font-semibold uppercase tracking-wider text-white">
          <Music2 size={15} /> {t('batchUpload.singleTrack')}
        </span>
        <Link to="/upload/batch" className="flex min-h-11 items-center justify-center gap-2 rounded text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
          <Layers3 size={15} /> {t('batchUpload.multiUpload')}
        </Link>
      </div>

      {/* Upload Box wrapper */}
      <div>
        <UploadForm />
      </div>
    </div>
  );
}
