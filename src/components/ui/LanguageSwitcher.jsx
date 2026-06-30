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
      <div className={`flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80 ${className}`}>
        {languages.map((lang) => {
          const active = currentLang.startsWith(lang.code);
          return (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold tracking-wider cursor-pointer transition-all ${
                active
                  ? 'bg-brand-red text-[var(--ns-on-accent)] shadow-[0_0_10px_var(--ns-accent-glow)]'
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
      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
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
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-between ${
                active
                  ? 'bg-brand-red/15 text-rose-300 border-brand-red/40 shadow-[0_0_12px_var(--ns-accent-glow-soft)]'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:bg-zinc-800/80 hover:text-zinc-100'
              }`}
            >
              <span>{lang.label}</span>
              <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                {lang.short}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
