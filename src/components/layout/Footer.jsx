import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LEGAL_NAV } from '../../constants/legalContent';

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-10 flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-t border-[var(--ns-border-subtle)] py-5 text-ns-meta text-zinc-500">
      <span>© {new Date().getFullYear()} NoirSound</span>
      <details className="max-w-full text-right">
        <summary className="min-h-8 cursor-pointer hover:text-zinc-300">{t('interface.legal')}</summary>
        <nav aria-label={t('interface.legal')} className="mt-2 flex max-w-lg flex-wrap justify-end gap-x-4 gap-y-2">
          {LEGAL_NAV.map(item => <Link key={item.slug} to={item.path} className="inline-flex min-h-8 items-center hover:text-zinc-300">{item.label}</Link>)}
        </nav>
      </details>
    </footer>
  );
}
