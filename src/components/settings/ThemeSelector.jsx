import React from 'react';
import { Check, MonitorCog, Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { THEMES, THEME_IDS } from '../../theme/themes';
import { useThemeStore } from '../../store/themeStore';

function ThemeSwatches({ theme }) {
  const colors = [
    theme.colors.bg,
    theme.colors.card,
    theme.colors.accent,
    theme.colors.accentStrong,
  ];

  return (
    <span className="flex items-center -space-x-1" aria-hidden="true">
      {colors.map((color, index) => (
        <span
          key={`${theme.id}-${color}-${index}`}
          className="block h-5 w-5 rounded-full border-2 border-[var(--ns-card-solid)] shadow-sm"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

export default function ThemeSelector({ compact = false, className = '' }) {
  const { t } = useTranslation();
  const selectedTheme = useThemeStore((state) => state.selectedTheme);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const setTheme = useThemeStore((state) => state.setTheme);

  if (compact) {
    return (
      <label
        className={`flex items-center gap-2 rounded-md border border-[var(--ns-border-subtle)] bg-zinc-900/65 px-2.5 py-2 ${className}`}
      >
        <Palette size={14} className="text-brand-red shrink-0" aria-hidden="true" />
        <span className="sr-only">{t('settings.theme')}</span>
        <select
          data-testid="compact-theme-selector"
          value={selectedTheme}
          onChange={(event) => setTheme(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[11px] font-bold text-zinc-300 outline-none cursor-pointer"
          aria-label={t('settings.theme')}
        >
          {THEME_IDS.map((themeId) => (
            <option key={themeId} value={themeId} className="bg-zinc-950 text-zinc-200">
              {t(THEMES[themeId].labelKey)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <section className={className} aria-labelledby="theme-selector-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-brand-red/20 bg-brand-red/10 text-brand-red">
          <Palette size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 id="theme-selector-title" className="text-sm font-semibold text-zinc-100">
            {t('settings.appearance')}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {t('settings.themeDescription')}
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label={t('settings.theme')}
        data-testid="theme-selector"
        className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {THEME_IDS.map((themeId) => {
          const theme = THEMES[themeId];
          const selected = selectedTheme === themeId;
          const isSystem = themeId === 'system';

          return (
            <button
              key={themeId}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`theme-option-${themeId}`}
              data-theme-id={themeId}
              onClick={() => setTheme(themeId)}
              className={`relative min-h-28 cursor-pointer rounded-lg border p-4 text-left transition-colors ${
                selected
                  ? 'border-brand-red/60 bg-brand-red/8'
                  : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-900/70'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {isSystem ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300">
                    <MonitorCog size={17} aria-hidden="true" />
                  </span>
                ) : (
                  <ThemeSwatches theme={theme} />
                )}
                {selected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-1 font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--ns-on-accent)]">
                    <Check size={11} aria-hidden="true" />
                    {t('themes.selected')}
                  </span>
                )}
              </div>
              <span className="mt-3 block text-sm font-semibold text-zinc-100">
                {t(theme.labelKey)}
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-zinc-500">
                {t(theme.descriptionKey)}
              </span>
              {isSystem && (
                <span className="mt-2 block text-[10px] font-semibold text-brand-red">
                  {t(THEMES[resolvedTheme].labelKey)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-zinc-500">{t('settings.themeLocalOnly')}</p>
    </section>
  );
}
