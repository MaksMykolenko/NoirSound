import { create } from 'zustand';
import { DEFAULT_THEME, SYSTEM_THEME, isThemeId } from '../theme/themes';
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
} from '../theme/themeUtils';

let removeSystemListener = null;

const initialSelectedTheme = readStoredTheme();

export const useThemeStore = create((set, get) => ({
  selectedTheme: initialSelectedTheme,
  resolvedTheme: resolveTheme(initialSelectedTheme),

  setTheme: (themeId) => {
    const selectedTheme = isThemeId(themeId) ? themeId : DEFAULT_THEME;
    persistTheme(selectedTheme);
    const resolvedTheme = applyTheme(selectedTheme);
    set({ selectedTheme, resolvedTheme });
    return resolvedTheme;
  },

  hydrateTheme: () => {
    const selectedTheme = readStoredTheme();
    const resolvedTheme = applyTheme(selectedTheme);
    set({ selectedTheme, resolvedTheme });
    return resolvedTheme;
  },

  listenToSystemTheme: () => {
    removeSystemListener?.();
    removeSystemListener = null;

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {};
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      if (get().selectedTheme !== SYSTEM_THEME) return;
      const resolvedTheme = applyTheme(SYSTEM_THEME, mediaQuery);
      set({ resolvedTheme });
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      removeSystemListener = () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      removeSystemListener = () => mediaQuery.removeListener(handleChange);
    }

    return () => {
      removeSystemListener?.();
      removeSystemListener = null;
    };
  },
}));
