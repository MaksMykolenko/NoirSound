import {
  DEFAULT_THEME,
  SYSTEM_THEME,
  THEME_STORAGE_KEY,
  THEMES,
  isThemeId,
} from './themes';

export function getSystemResolvedTheme(mediaQuery) {
  const query = mediaQuery
    ?? (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: light)')
      : null);
  return query?.matches ? 'light-minimal' : DEFAULT_THEME;
}

export function resolveTheme(selectedTheme, mediaQuery) {
  const validTheme = isThemeId(selectedTheme) ? selectedTheme : DEFAULT_THEME;
  return validTheme === SYSTEM_THEME
    ? getSystemResolvedTheme(mediaQuery)
    : validTheme;
}

export function readStoredTheme(storage) {
  const source = storage
    ?? (typeof window !== 'undefined' ? window.localStorage : null);
  try {
    const storedTheme = source?.getItem(THEME_STORAGE_KEY);
    return isThemeId(storedTheme) ? storedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function persistTheme(selectedTheme, storage) {
  const themeId = isThemeId(selectedTheme) ? selectedTheme : DEFAULT_THEME;
  const target = storage
    ?? (typeof window !== 'undefined' ? window.localStorage : null);
  try {
    target?.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // Storage may be disabled. The current document still receives the theme.
  }
  return themeId;
}

export function applyTheme(selectedTheme, mediaQuery, documentElement) {
  const themeId = isThemeId(selectedTheme) ? selectedTheme : DEFAULT_THEME;
  const resolvedTheme = resolveTheme(themeId, mediaQuery);
  const root = documentElement
    ?? (typeof document !== 'undefined' ? document.documentElement : null);

  if (root) {
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = themeId;
    root.style.colorScheme = THEMES[resolvedTheme].mode;

    const ownerDocument = root.ownerDocument
      ?? (typeof document !== 'undefined' ? document : null);
    ownerDocument
      ?.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEMES[resolvedTheme].colors.bg);
  }

  return resolvedTheme;
}
