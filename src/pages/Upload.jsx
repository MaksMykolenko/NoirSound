import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers3, Music2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import UploadForm from '../components/upload/UploadForm';

export default function Upload() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Title */}
      <div className="text-center space-y-2">
        <span className="ns-eyebrow text-brand-red">Creator release flow</span>
        <h1 className="ns-page-title mt-2">{t('nav.upload')}</h1>
        <p className="ns-page-lede max-w-lg mx-auto">
          Send your original release through NoirSound’s private processing pipeline.
        </p>
      </div>

      <div className="mx-auto max-w-3xl grid grid-cols-2 gap-2 p-1.5 ns-card">
        <span className="min-h-11 rounded-xl bg-brand-red text-white flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider">
          <Music2 size={15} /> {t('batchUpload.singleTrack')}
        </span>
        <Link to="/upload/batch" className="min-h-11 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider">
          <Layers3 size={15} /> {t('batchUpload.multiUpload')}
        </Link>
      </div>

      {/* Upload Box wrapper */}
      <div className="pt-2">
        <UploadForm />
      </div>
    </div>
  );
}
