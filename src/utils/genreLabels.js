// English-only genre label helpers.
//
// Backend/database always store a stable key (e.g. "hip_hop"); these helpers map
// a key (or a legacy/custom value) to its display label. Genre and genre-group
// NAMES are product/music-taxonomy terms, not UI copy — they are always shown
// in English, regardless of the active UI language (en/uk/pl/ru). Only the
// surrounding UI labels (e.g. the word "Genre:") are translated via i18n.
// See NOIRSOUND_GENRE_LABELS_AUDIT.md / NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md.
//
// User-supplied tags are NOT touched here — only platform-known genre keys.

import {
  MUSIC_GENRES,
  normalizeGenre,
  isSupportedGenre,
  getLabelOfKey,
  getLabelOfGroup,
} from '../constants/musicGenres';

/** Humanize a snake_case key as a last-resort display fallback (English-like, never localized). */
function prettifyKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * English display label for a genre key (or legacy/freeform value). Always
 * English, regardless of UI language — genre names are never translated.
 *
 * @param {string} key         genre key or legacy/custom value
 * @param {string} [_language] ignored. Kept for call-site backward
 *   compatibility with the old i18n-aware signature `getGenreLabel(key, lng)`;
 *   genre names no longer vary by locale.
 * @returns {string} English label, or the raw value verbatim for unknown/custom genres
 */
export function getGenreLabel(key, _language) {
  if (!key) return '';
  const norm = normalizeGenre(key);
  if (!norm) {
    // Unknown/custom genre — display the original text safely (never crash,
    // never localized).
    return String(key);
  }
  return getLabelOfKey(norm) ?? prettifyKey(norm);
}

/**
 * English display label for a genre group key. Always English, regardless of
 * UI language.
 *
 * @param {string} groupKey
 * @param {string} [_language] ignored — see getGenreLabel.
 */
export function getGenreGroupLabel(groupKey, _language) {
  if (!groupKey) return '';
  return getLabelOfGroup(groupKey) ?? prettifyKey(groupKey);
}

/**
 * Search the taxonomy by (English) label, key, or alias. Search terms are
 * always matched/displayed in English — there is no per-language index.
 * @param {string} query
 * @param {string} [_language] ignored — see getGenreLabel.
 * @returns {Array<{key,group,label,aliases}>}
 */
export function searchGenres(query, _language) {
  const entries = MUSIC_GENRES.map((g) => ({
    key: g.key,
    group: g.group,
    aliases: g.aliases,
    label: g.label,
  }));

  const q = String(query || '').trim().toLowerCase();
  if (!q) return entries;
  const qSlug = q.replace(/[\s-]+/g, '_');

  return entries.filter((g) => {
    if (g.key.includes(qSlug)) return true;
    if (g.key.replace(/_/g, ' ').includes(q)) return true;
    if (g.label.toLowerCase().includes(q)) return true;
    if (g.aliases.some((a) => a.toLowerCase().includes(q))) return true;
    const norm = normalizeGenre(q);
    return Boolean(norm) && norm === g.key;
  });
}

export { normalizeGenre, isSupportedGenre };
