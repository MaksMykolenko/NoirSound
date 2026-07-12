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
            className="group relative min-h-36 overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-4 transition-colors hover:border-zinc-700/70 hover:bg-zinc-900/40"
          >
            <div className="relative">
              <span className="mb-4 flex h-9 w-9 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-brand-red transition-colors group-hover:border-brand-red/30">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="text-[13px] font-semibold text-zinc-100">
                {t(`home.${key}Title`)}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {t(`home.${key}Desc`)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
