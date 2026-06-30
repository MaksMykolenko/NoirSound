import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeStore } from '../themeStore';
import {
  DEFAULT_THEME,
  SYSTEM_THEME,
  THEME_STORAGE_KEY,
} from '../../theme/themes';

describe('themeStore', () => {
  let listeners;
  let mediaQuery;
  let stopListening;

  beforeEach(() => {
    localStorage.clear();
    listeners = new Set();
    mediaQuery = {
      matches: false,
      addEventListener: vi.fn((_event, listener) => listeners.add(listener)),
      removeEventListener: vi.fn((_event, listener) => listeners.delete(listener)),
    };
    window.matchMedia = vi.fn(() => mediaQuery);
    document.documentElement.dataset.theme = DEFAULT_THEME;
    document.documentElement.dataset.themePreference = DEFAULT_THEME;
    useThemeStore.setState({
      selectedTheme: DEFAULT_THEME,
      resolvedTheme: DEFAULT_THEME,
    });
  });

  afterEach(() => {
    stopListening?.();
    stopListening = null;
  });

  it('defaults to Noir Pink', () => {
    expect(useThemeStore.getState().selectedTheme).toBe(DEFAULT_THEME);
    expect(useThemeStore.getState().resolvedTheme).toBe(DEFAULT_THEME);
  });

  it('persists a concrete selection and applies it to the document', () => {
    useThemeStore.getState().setTheme('midnight-blue');

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('midnight-blue');
    expect(document.documentElement.dataset.theme).toBe('midnight-blue');
    expect(document.documentElement.dataset.themePreference).toBe('midnight-blue');
  });

  it('resolves System from OS preference and updates without replacing the selection', () => {
    mediaQuery.matches = true;
    useThemeStore.getState().setTheme(SYSTEM_THEME);
    stopListening = useThemeStore.getState().listenToSystemTheme();

    expect(useThemeStore.getState().selectedTheme).toBe(SYSTEM_THEME);
    expect(useThemeStore.getState().resolvedTheme).toBe('light-minimal');

    mediaQuery.matches = false;
    listeners.forEach((listener) => listener({ matches: false }));

    expect(useThemeStore.getState().selectedTheme).toBe(SYSTEM_THEME);
    expect(useThemeStore.getState().resolvedTheme).toBe(DEFAULT_THEME);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(SYSTEM_THEME);
  });
});
