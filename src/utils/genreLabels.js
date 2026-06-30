// i18n-aware genre label helpers.
//
// Backend/database always store a stable key (e.g. "hip_hop"); these helpers map
// a key (or a legacy/custom value) to a localized display label. User-supplied
// tags are NOT translated here — only platform-known genre keys.

import i18n from '../i18n';
import { MUSIC_GENRES, normalizeGenre, isSupportedGenre } from '../constants/musicGenres';

/** Humanize a snake_case key as a last-resort display fallback. */
function prettifyKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Localized label for a genre key (or legacy value).
 * @param {string} key   genre key or legacy/custom value
 * @param {string} [language] BCP-47 code; defaults to the active language
 * @returns {string} localized label, or the raw value for unknown/custom genres
 */
export function getGenreLabel(key, language) {
  if (!key) return '';
  const norm = normalizeGenre(key);
  if (!norm) {
    // Unknown/custom genre — display the original text safely (never crash).
    return String(key);
  }
  const options = { defaultValue: '' };
  if (language) options.lng = language;
  const label = i18n.t(`genres.${norm}`, options);
  return label || prettifyKey(norm);
}

/**
 * Localized label for a genre group key.
 * @param {string} groupKey
 * @param {string} [language]
 */
export function getGenreGroupLabel(groupKey, language) {
  if (!groupKey) return '';
  const options = { defaultValue: '' };
  if (language) options.lng = language;
  const label = i18n.t(`genreGroups.${groupKey}`, options);
  return label || prettifyKey(groupKey);
}

/**
 * Search the taxonomy by localized label, key, or alias.
 * @param {string} query
 * @param {string} [language]
 * @returns {Array<{key,group,label,aliases}>}
 */
export function searchGenres(query, language) {
  const lng = language || i18n.language;
  const entries = MUSIC_GENRES.map((g) => ({
    key: g.key,
    group: g.group,
    aliases: g.aliases,
    label: getGenreLabel(g.key, lng),
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
