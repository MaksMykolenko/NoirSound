import i18n from '../i18n';

/**
 * Compact, locale-aware formatting for social-proof counters (followers,
 * plays, monthly listeners, likes, tracks played, ...). Matches the product
 * spec exactly: 0 -> "0", 1 -> "1", 999 -> "999", 1200 -> "1.2K",
 * 1400000 -> "1.4M". This is the one formatter every counter in the app
 * should go through so the same metric never renders two different ways on
 * two different pages.
 */
export function formatNumber(value) {
  const num = Number(value || 0);
  const lang = i18n.language || 'en';
  return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(num);
}

/** Full, non-abbreviated locale-grouped number (e.g. admin/ops precision views). */
export function formatExactNumber(value) {
  const num = Number(value || 0);
  const lang = i18n.language || 'en';
  return new Intl.NumberFormat(lang).format(num);
}

export function formatDate(dateValue, options = { month: 'short', year: 'numeric' }) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  const lang = i18n.language || 'en';
  return new Intl.DateTimeFormat(lang, options).format(date);
}
