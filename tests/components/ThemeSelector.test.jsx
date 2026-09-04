import React from 'react';
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

  it('shows the resolved theme for the selected System option', () => {
    useThemeStore.setState({ selectedTheme: 'system', resolvedTheme: 'light-minimal' });

    render(<ThemeSelector />);

    const system = screen.getByTestId('theme-option-system');
    expect(system).toHaveAttribute('aria-checked', 'true');
    expect(system.querySelector('[data-preview-theme]')).toHaveAttribute(
      'data-preview-theme',
      'light-minimal'
    );
    expect(system).toHaveTextContent('Light Minimal');
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

  it('supports roving focus and arrow-key selection across theme radios', async () => {
    const user = userEvent.setup();
    render(<ThemeSelector />);

    const selected = screen.getByTestId('theme-option-noir-pink');
    const next = screen.getByTestId('theme-option-midnight-blue');
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(next).toHaveAttribute('tabindex', '-1');

    selected.focus();
    await user.keyboard('{ArrowRight}');

    expect(next).toHaveFocus();
    expect(next).toHaveAttribute('aria-checked', 'true');
    expect(next).toHaveAttribute('tabindex', '0');
    expect(document.documentElement.dataset.theme).toBe('midnight-blue');
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

});
