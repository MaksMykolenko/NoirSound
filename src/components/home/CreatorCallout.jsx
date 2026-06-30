import React from 'react';
import { ArrowUpRight, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CreatorCallout({ onUpload }) {
  const { t } = useTranslation();

  return (
    <section
      data-testid="home-creator-callout"
      className="relative overflow-hidden ns-card p-5 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5"
    >
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-red/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-start gap-4 max-w-2xl">
        <span className="w-12 h-12 rounded-2xl bg-brand-red/10 border border-brand-red/25 text-brand-red flex items-center justify-center shrink-0">
          <UploadCloud size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="ns-eyebrow text-rose-300">{t('home.creatorCtaEyebrow')}</p>
          <h2 className="mt-1.5 text-xl sm:text-2xl font-black tracking-tight text-zinc-100">
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
        className="relative ns-button-primary px-5 text-xs uppercase tracking-widest cursor-pointer inline-flex items-center justify-center gap-2 shrink-0"
      >
        <span>{t('actions.uploadTrack')}</span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
