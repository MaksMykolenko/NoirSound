import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import ThemeSelector from '../../src/components/settings/ThemeSelector';
import { DEFAULT_THEME, THEMES, THEME_IDS } from '../../src/theme/themes';
import { useThemeStore } from '../../src/store/themeStore';
import i18n from '../../src/i18n';

describe('ThemeSelector', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
    useThemeStore.setState({
      selectedTheme: DEFAULT_THEME,
      resolvedTheme: DEFAULT_THEME,
    });
    document.documentElement.dataset.theme = DEFAULT_THEME;
    document.documentElement.dataset.themePreference = DEFAULT_THEME;
  });

  it('renders every theme as an accessible radio option', () => {
    render(<ThemeSelector />);

    expect(screen.getAllByRole('radio')).toHaveLength(THEME_IDS.length);
    expect(screen.getByTestId('theme-option-noir-pink')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('theme-option-system')).toHaveAttribute('aria-checked', 'false');
  });

  it('applies and persists a selected theme immediately', async () => {
    const user = userEvent.setup();
    render(<ThemeSelector />);

    await user.click(screen.getByTestId('theme-option-light-minimal'));

    expect(document.documentElement.dataset.theme).toBe('light-minimal');
    expect(document.documentElement.dataset.themePreference).toBe('light-minimal');
    expect(localStorage.getItem('noirsound.theme')).toBe('light-minimal');
    expect(screen.getByTestId('theme-option-light-minimal')).toHaveAttribute('aria-checked', 'true');
  });

  it('includes and applies both platform-inspired themes', async () => {
    const user = userEvent.setup();
    render(<ThemeSelector />);

    expect(THEMES['green-stream']).toBeDefined();
    expect(THEMES['orange-wave']).toBeDefined();
    expect(screen.getByText('Green Stream')).toBeInTheDocument();
    expect(screen.getByText('Orange Wave')).toBeInTheDocument();

    await user.click(screen.getByTestId('theme-option-green-stream'));
    expect(document.documentElement.dataset.theme).toBe('green-stream');
    expect(localStorage.getItem('noirsound.theme')).toBe('green-stream');

    await user.click(screen.getByTestId('theme-option-orange-wave'));
    expect(document.documentElement.dataset.theme).toBe('orange-wave');
    expect(localStorage.getItem('noirsound.theme')).toBe('orange-wave');
  });

  it('localizes the new theme names', async () => {
    expect(i18n.t('themes.greenStream')).toBe('Green Stream');
    expect(i18n.t('themes.orangeWave')).toBe('Orange Wave');

    await i18n.changeLanguage('uk');
    expect(i18n.t('themes.greenStream')).toBe('Зелений потік');
    expect(i18n.t('themes.orangeWave')).toBe('Помаранчева хвиля');

    await i18n.changeLanguage('pl');
    expect(i18n.t('themes.greenStream')).toBe('Zielony strumień');
    expect(i18n.t('themes.orangeWave')).toBe('Pomarańczowa fala');

    await i18n.changeLanguage('ru');
    expect(i18n.t('themes.greenStream')).toBe('Зелёный поток');
    expect(i18n.t('themes.orangeWave')).toBe('Оранжевая волна');
  });

  it('keeps default accent literals out of key components', () => {
    const root = process.cwd();
    const keyFiles = [
      'src/components/layout/Sidebar.jsx',
      'src/components/player/PlayerBar.jsx',
      'src/components/upload/UploadForm.jsx',
      'src/components/ui/GenrePill.jsx',
      'src/components/home/HomeHero.jsx',
      'src/components/settings/ThemeSelector.jsx',
    ];

    for (const file of keyFiles) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      expect(source).not.toMatch(/#f02255|#e11d48|rgba\(240,\s*34,\s*85/);
    }
  });

  it('defines every required semantic variable for Light Minimal', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    const lightTheme = css.split(":root[data-theme='light-minimal']")[1]?.split('/* App foundation')[0] ?? '';
    const requiredTokens = [
      '--ns-bg',
      '--ns-bg-elevated',
      '--ns-card',
      '--ns-card-soft',
      '--ns-border',
      '--ns-text',
      '--ns-text-muted',
      '--ns-accent',
      '--ns-accent-soft',
      '--ns-accent-strong',
      '--ns-danger',
      '--ns-success',
      '--ns-warning',
    ];

    for (const token of requiredTokens) {
      expect(lightTheme).toContain(token);
    }
  });

  it('defines every required semantic variable for both new themes', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    const requiredTokens = [
      '--ns-bg',
      '--ns-bg-elevated',
      '--ns-card',
      '--ns-card-soft',
      '--ns-border',
      '--ns-text',
      '--ns-text-muted',
      '--ns-accent',
      '--ns-accent-soft',
      '--ns-accent-strong',
      '--ns-accent-glow',
    ];

    for (const themeId of ['green-stream', 'orange-wave']) {
      const themeBlock = css
        .split(`:root[data-theme='${themeId}']`)[1]
        ?.split('\n}')[0] ?? '';
      for (const token of requiredTokens) {
        expect(themeBlock).toContain(token);
      }
    }
  });
});
