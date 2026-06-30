import i18n from '../i18n';

// Backend error codes (stable, machine-readable) that have curated, localized
// end-user copy under the `errors.<CODE>` i18n namespace.
const FRIENDLY_CODES = new Set(['CSRF_VALIDATION_FAILED', 'RATE_LIMITED']);

/**
 * Resolve a friendly, localized message for a failed API request.
 *
 * The raw backend code (e.g. `CSRF_VALIDATION_FAILED`) is never surfaced to end
 * users — it stays in developer logs (ApiError.message + the backend's
 * structured log). This accepts either an ApiError instance or the
 * `noirsound:api-error` event detail (`{ message, status, code }`).
 *
 * @param {{ code?: string|null, status?: number, message?: string }|string} error
 * @param {(key: string) => string} [t] Optional i18n `t` (e.g. from a component).
 * @returns {string}
 */
export function getApiErrorMessage(error, t) {
  const translate = typeof t === 'function' ? t : i18n.t.bind(i18n);
  const code = (error && typeof error === 'object' && error.code) || null;
  const status = error && typeof error === 'object' ? error.status : undefined;

  // 1) Curated localized copy for known, stable codes.
  if (code && FRIENDLY_CODES.has(code)) {
    const key = `errors.${code}`;
    const translated = translate(key);
    if (translated && translated !== key) return translated;
  }

  // 2) Network / fetch failures (ApiError uses status 0).
  if (status === 0) {
    const networkMsg = translate('errors.network');
    if (networkMsg && networkMsg !== 'errors.network') return networkMsg;
  }

  // 3) A human server message, if any — but never a raw SCREAMING_SNAKE code.
  const raw = typeof error === 'string' ? error : (error && error.message);
  if (raw && !/^[A-Z][A-Z0-9_]+$/.test(raw)) return raw;

  // 4) Generic fallback.
  return translate('errors.generic');
}
