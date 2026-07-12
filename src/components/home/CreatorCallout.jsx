import React from 'react';
import { ArrowUpRight, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CreatorCallout({ onUpload }) {
  const { t } = useTranslation();

  return (
    <section
      data-testid="home-creator-callout"
      className="relative flex flex-col gap-5 overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-5 md:flex-row md:items-center md:justify-between"
    >
      <div className="relative flex items-start gap-4 max-w-2xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-brand-red/25 bg-brand-red/5 text-brand-red">
          <UploadCloud size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="ns-eyebrow text-rose-300">{t('home.creatorCtaEyebrow')}</p>
          <h2 className="ns-display-title ns-display-title--editorial mt-1.5 text-zinc-100">
            {t('home.creatorCtaTitle')}
          </h2>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            {t('home.creatorCtaDesc')}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onUpload}
        className="relative ns-button-primary px-5 text-sm cursor-pointer inline-flex items-center justify-center gap-2 shrink-0"
      >
        <span>{t('actions.uploadTrack')}</span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
