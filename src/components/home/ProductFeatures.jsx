import React from 'react';
import { BarChart3, Compass, Library, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FEATURE_DEFINITIONS = [
  { key: 'feat1', Icon: Compass },
  { key: 'feat2', Icon: UploadCloud },
  { key: 'feat3', Icon: Library },
  { key: 'feat4', Icon: BarChart3 },
];

export default function ProductFeatures() {
  const { t } = useTranslation();

  return (
    <section data-testid="home-features" className="space-y-4">
      <div>
        <h2 className="ns-section-title">{t('home.featuresTitle')}</h2>
        <p className="text-sm text-zinc-400 mt-1">{t('home.featuresSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {FEATURE_DEFINITIONS.map(({ key, Icon }) => (
          <article
            key={key}
            className="group relative overflow-hidden p-5 ns-card ns-card-interactive min-h-44"
          >
            <div className="absolute -right-10 -top-10 w-28 h-28 rounded-full bg-brand-red/0 blur-3xl group-hover:bg-brand-red/10 transition-colors duration-500" />
            <div className="relative">
              <span className="w-11 h-11 rounded-xl bg-zinc-950 border border-zinc-800 text-brand-red flex items-center justify-center mb-5 group-hover:border-brand-red/30 group-hover:shadow-[0_0_20px_var(--ns-accent-glow-soft)] transition-all">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="text-[15px] font-extrabold text-zinc-100">
                {t(`home.${key}Title`)}
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                {t(`home.${key}Desc`)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
