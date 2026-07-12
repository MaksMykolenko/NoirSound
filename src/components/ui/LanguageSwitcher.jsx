import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useUserStore } from '../../store/userStore';

const languages = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'uk', label: 'Українська', short: 'UA' },
  { code: 'pl', label: 'Polski', short: 'PL' },
  { code: 'ru', label: 'Русский', short: 'RU' },
];

export default function LanguageSwitcher({ compact = false, className = '' }) {
  const { i18n, t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const updateUserStore = useUserStore((state) => state.updateUser);
  const currentLang = i18n.language || 'en';

  const handleLanguageChange = async (code) => {
    if (code === currentLang) return;
    await i18n.changeLanguage(code);
    localStorage.setItem('noirsound_language', code);

    if (user) {
      updateUserStore({ preferredLanguage: code }).catch(() => {});
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-900/80 p-1 ${className}`}>
        {languages.map((lang) => {
          const active = currentLang.startsWith(lang.code);
          return (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`cursor-pointer rounded px-2 py-1 font-sans tabular-nums text-ns-meta font-medium tracking-ns-label transition-colors ${
                active
                  ? 'bg-brand-red text-[var(--ns-on-accent)]'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
              title={lang.label}
              aria-label={lang.label}
            >
              {lang.short}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="flex items-center gap-2 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">
        <Globe size={14} className="text-brand-red" />
        <span>{t('language.label')}</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        {languages.map((lang) => {
          const active = currentLang.startsWith(lang.code);
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLanguageChange(lang.code)}
              className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-brand-red/40 bg-brand-red/10 text-rose-300'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:bg-zinc-800/80 hover:text-zinc-100'
              }`}
            >
              <span>{lang.label}</span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-sans tabular-nums text-ns-meta font-medium uppercase text-zinc-400">
                {lang.short}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
