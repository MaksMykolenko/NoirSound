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

function ThemePreview({ theme, isSystem }) {
  return (
    <span
      data-preview-theme={theme.id}
      className="relative block h-16 overflow-hidden rounded-md border"
      style={{ backgroundColor: theme.colors.bg, borderColor: theme.colors.border }}
      aria-hidden="true"
    >
      <span
        className="flex h-3 items-center gap-1 border-b px-1.5"
        style={{ backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }}
      >
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
        <span className="h-1 w-3 rounded-full" style={{ backgroundColor: theme.colors.textMuted }} />
      </span>
      <span className="grid h-[3.25rem] grid-cols-[28%_1fr]">
        <span
          className="flex flex-col gap-1 border-r p-1.5"
          style={{ backgroundColor: theme.colors.cardSoft, borderColor: theme.colors.border }}
        >
          <span className="h-1.5 w-4/5 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
          <span className="h-1 w-full rounded-full opacity-60" style={{ backgroundColor: theme.colors.textMuted }} />
          <span className="h-1 w-3/4 rounded-full opacity-40" style={{ backgroundColor: theme.colors.textMuted }} />
        </span>
        <span className="grid grid-cols-2 gap-1.5 p-1.5">
          <span className="rounded-sm border" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} />
          <span className="rounded-sm border" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} />
          <span
            className="col-span-2 h-1.5 self-end rounded-full"
            style={{ backgroundColor: theme.colors.accentStrong }}
          />
        </span>
      </span>
      {isSystem && (
        <span
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded border shadow-sm"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }}
        >
          <MonitorCog size={13} />
        </span>
      )}
    </span>
  );
}

export default function ThemeSelector({ compact = false, className = '' }) {
  const { t } = useTranslation();
  const selectedTheme = useThemeStore((state) => state.selectedTheme);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const handleThemeKeyDown = (event, themeId) => {
    const currentIndex = THEME_IDS.indexOf(themeId);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % THEME_IDS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + THEME_IDS.length) % THEME_IDS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = THEME_IDS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextThemeId = THEME_IDS[nextIndex];
    setTheme(nextThemeId);
    event.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelector(`[data-theme-id="${nextThemeId}"]`)
      ?.focus();
  };

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
          className="min-w-0 flex-1 cursor-pointer bg-transparent text-base font-bold text-zinc-300 outline-none sm:text-ns-label"
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
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            {t('settings.themeDescription')}
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label={t('settings.theme')}
        data-testid="theme-selector"
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 [grid-auto-rows:1fr]"
      >
        {THEME_IDS.map((themeId) => {
          const theme = THEMES[themeId];
          const selected = selectedTheme === themeId;
          const isSystem = themeId === 'system';
          const previewTheme = isSystem
            ? (THEMES[resolvedTheme] || THEMES['noir-pink'])
            : theme;

          return (
            <button
              key={themeId}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              data-testid={`theme-option-${themeId}`}
              data-theme-id={themeId}
              onClick={() => setTheme(themeId)}
              onKeyDown={(event) => handleThemeKeyDown(event, themeId)}
              className={`relative flex h-full min-h-48 cursor-pointer flex-col rounded-lg border p-4 text-left transition-colors ${
                selected
                  ? 'border-brand-red/60 bg-brand-red/8'
                  : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-900/70'
              }`}
            >
              <ThemePreview theme={previewTheme} isSystem={isSystem} />
              <div className="mt-3 flex min-h-6 items-center justify-between gap-3">
                <ThemeSwatches theme={previewTheme} />
                {selected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-1 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-[var(--ns-on-accent)]">
                    <Check size={11} aria-hidden="true" />
                    {t('themes.selected')}
                  </span>
                )}
              </div>
              <span className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-100">{t(theme.labelKey)}</span>
                {isSystem && (
                  <span className="shrink-0 text-ns-meta font-semibold text-brand-red">
                    {t(previewTheme.labelKey)}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-ns-label leading-relaxed text-zinc-500">
                {t(theme.descriptionKey)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-ns-meta text-zinc-500">{t('settings.themeLocalOnly')}</p>
    </section>
  );
}
