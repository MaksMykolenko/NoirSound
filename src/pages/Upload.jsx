import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers3, Music2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import UploadForm from '../components/upload/UploadForm';

export default function Upload() {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-in space-y-7 [&_.ns-button-primary]:!rounded [&_.ns-button-secondary]:!rounded [&_.ns-field]:!rounded [&_.ns-icon-button]:!rounded">
      <header className="flex flex-col gap-5 border-b border-zinc-800/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-brand-red">{t('uploadForm.creatorFlowLabel')}</span>
          <h1 className="ns-page-title mt-2">{t('nav.upload')}</h1>
          <p className="ns-page-lede">
            {t('uploadForm.pageIntro')}
          </p>
        </div>

        <nav aria-label={t('nav.upload')} className="flex w-full border-b border-zinc-800 lg:w-auto lg:min-w-[24rem]">
          <span aria-current="page" className="flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 border-brand-red px-4 text-sm font-semibold text-zinc-100">
            <Music2 size={15} /> {t('batchUpload.singleTrack')}
          </span>
          <Link to="/upload/batch" className="flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 border-transparent px-4 text-sm font-semibold text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-100">
            <Layers3 size={15} /> {t('batchUpload.multiUpload')}
          </Link>
        </nav>
      </header>

      <UploadForm />
    </div>
  );
}
