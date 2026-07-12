import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Home } from 'lucide-react';
import PageMeta from '../components/meta/PageMeta';

export default function NotFound() {
  const { t } = useTranslation();
  const canonical = typeof window === 'undefined'
    ? 'https://noirsound.co/404'
    : `${window.location.origin}${window.location.pathname}`;

  return (
    <div className="flex min-h-[58vh] flex-col items-center justify-center px-4 py-10 text-center">
      <PageMeta
        title="Page not found · NoirSound"
        description="This NoirSound page could not be found."
        canonical={canonical}
      />
      <span className="ns-eyebrow relative mb-3 text-brand-red">Lost in the static</span>
      <h1 className="relative mb-4 font-sans text-7xl font-semibold tracking-tighter text-brand-red sm:text-8xl">
        404
      </h1>
      <h2 className="relative mb-2 font-sans text-xl font-semibold text-zinc-100">This signal went dark</h2>
      <p className="text-sm leading-relaxed text-zinc-400 max-w-md mx-auto mb-8 relative">
        The page may have moved, been removed, or never existed in this part of NoirSound.
      </p>
      <div className="flex w-full max-w-sm flex-col items-stretch justify-center gap-2.5 min-[420px]:w-auto min-[420px]:max-w-none min-[420px]:flex-row">
        <Link
          to="/"
          className="ns-button-primary relative flex items-center justify-center space-x-2 rounded-md px-6"
        >
          <Home size={18} aria-hidden="true" />
          <span>{t('playlists.returnHome')}</span>
        </Link>
        <Link
          to="/discover"
          className="ns-button-secondary relative flex items-center justify-center space-x-2 rounded-md px-6"
        >
          <Compass size={18} aria-hidden="true" />
          <span>{t('actions.discoverMusic')}</span>
        </Link>
      </div>
    </div>
  );
}
