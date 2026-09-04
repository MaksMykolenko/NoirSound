import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, UserCheck, ShieldCheck, ArrowRight, UploadCloud } from 'lucide-react';

export default function BeatsInfoCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const features = [
    {
      Icon: SlidersHorizontal,
      title: t('beats.homeInfoFeat1Title'),
      desc: t('beats.homeInfoFeat1Desc'),
    },
    {
      Icon: UserCheck,
      title: t('beats.homeInfoFeat2Title'),
      desc: t('beats.homeInfoFeat2Desc'),
    },
    {
      Icon: ShieldCheck,
      title: t('beats.homeInfoFeat3Title'),
      desc: t('beats.homeInfoFeat3Desc'),
    },
  ];

  return (
    <section
      data-testid="home-beats-info-card"
      className="relative overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-5 sm:p-7 md:p-8"
    >
      <div className="relative z-10">
        <div className="max-w-2xl">
          <p className="ns-eyebrow text-rose-300">
            {t('beats.homeInfoEyebrow')}
          </p>
          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
            {t('beats.homeInfoTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {t('beats.homeInfoDesc')}
          </p>
        </div>

        {/* Feature pillars */}
        <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3 sm:gap-4">
          {features.map(({ Icon, title, desc }, index) => (
            <div
              key={index}
              className="flex min-w-0 flex-col border-t border-zinc-800/70 pt-4"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded border border-brand-red/20 bg-brand-red/10 text-brand-red">
                <Icon size={16} aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-zinc-200">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {desc}
              </p>
            </div>
          ))}
        </div>

        {/* Call to actions */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="home-beats-info-discover"
            onClick={() => navigate('/discover?content=BEAT')}
            className="ns-button-primary flex cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-sm sm:px-5"
          >
            <span>{t('beats.browseBeats')}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="home-beats-info-upload"
            onClick={() => navigate('/upload')}
            className="ns-button-secondary flex cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-sm sm:px-5"
          >
            <UploadCloud size={15} aria-hidden="true" />
            <span>{t('content.uploadBeat')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
