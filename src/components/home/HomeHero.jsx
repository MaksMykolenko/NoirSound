import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HomeHero({ onDiscover }) {
  const { t } = useTranslation();
  return <header data-testid="home-hero" className="flex flex-wrap items-end justify-between gap-4">
    <h1 className="ns-page-title">{t('nav.home')}</h1>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" data-testid="home-hero-discover" onClick={onDiscover} className="ns-button-secondary flex items-center gap-2 px-4 text-sm">
        {t('actions.discoverMusic')}<ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  </header>;
}
