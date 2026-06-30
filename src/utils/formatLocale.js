import i18n from '../i18n';

export function formatNumber(value) {
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
