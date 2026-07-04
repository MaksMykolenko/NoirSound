// Canonical music-genre taxonomy (frontend ESM view).
//
// The data itself lives in shared/musicGenres.json so the backend (CommonJS)
// and the frontend (ESM) read the *same* source of truth. This module adds the
// derived lookups + pure helper functions used across the app.
//
// IMPORTANT: stable snake_case `key` values are what the backend/database store.
// Display labels are English-only and live right on the taxonomy (`label` per
// genre, `groupLabels` per group) — see src/utils/genreLabels.js for the
// lookup/fallback helpers. Genre names are never translated: the UI language
// (en/uk/pl/ru) must never change how a genre or genre group is displayed.
// See NOIRSOUND_GENRE_LABELS_AUDIT.md / NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md.

import taxonomy from '../../shared/musicGenres.json';

/** Ordered list of group keys (used for display grouping). */
export const GENRE_GROUPS = Object.freeze([...taxonomy.groups]);

/** Full taxonomy: [{ key, label, group, aliases }]. `label` is English-only. */
export const MUSIC_GENRES = Object.freeze(
  taxonomy.genres.map((g) => Object.freeze({ ...g, aliases: Object.freeze([...g.aliases]) }))
);

/** All canonical genre keys in taxonomy order. */
export const GENRE_KEYS = Object.freeze(MUSIC_GENRES.map((g) => g.key));

/** English-only group label, full form (e.g. "Hip-Hop & Urban"). Used in the genre picker's group headers. Never localized. */
export const GROUP_LABELS = Object.freeze({ ...taxonomy.groupLabels });

/**
 * English-only, compact group labels for space-constrained "quick filter" UI
 * (Discover quick tabs, Home "Browse by Genre" chips) — deliberately shorter
 * than GROUP_LABELS (e.g. "Hip-Hop" vs "Hip-Hop & Urban"). This is a display
 * concern, not taxonomy data, so it lives here rather than in the shared JSON.
 * Never localized — see NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md.
 */
export const QUICK_GROUP_LABELS = Object.freeze({
  popular: 'Popular',
  urban: 'Hip-Hop',
  electronic: 'Electronic',
  rock: 'Rock',
  chill: 'Chill',
  jazz_blues: 'Jazz',
  world: 'World',
});

const KEY_SET = new Set(GENRE_KEYS);
const GROUP_SET = new Set(GENRE_GROUPS);

// group -> [genre objects]
const GENRES_BY_GROUP = MUSIC_GENRES.reduce((acc, g) => {
  (acc[g.group] = acc[g.group] || []).push(g);
  return acc;
}, {});

// key -> group
const GROUP_OF = MUSIC_GENRES.reduce((acc, g) => {
  acc[g.key] = g.group;
  return acc;
}, {});

// key -> English label (single source of truth for genre display text).
const LABEL_OF = MUSIC_GENRES.reduce((acc, g) => {
  acc[g.key] = g.label;
  return acc;
}, {});

// slug(alias | key) -> canonical key
const SLUG_TO_KEY = {};
for (const g of MUSIC_GENRES) {
  for (const token of [g.key, ...g.aliases]) {
    SLUG_TO_KEY[slugifyGenre(token)] = g.key;
  }
}

/**
 * Normalize an arbitrary string into a stable, comparable slug.
 * Mirrors the slug logic used to build shared/musicGenres.json.
 */
export function slugifyGenre(input) {
  if (input == null) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Map any user/legacy genre input to a canonical key, or null if unknown.
 * Examples: 'Phonk'->'phonk', 'Dark Synth'->'synthwave', 'Hip Hop'->'hip_hop',
 * 'Lo-fi'->'lofi'. Unknown input returns null (caller decides the fallback).
 */
export function normalizeGenre(input) {
  if (input == null) return null;
  const slug = slugifyGenre(input);
  if (!slug) return null;
  if (KEY_SET.has(slug)) return slug;
  if (SLUG_TO_KEY[slug]) return SLUG_TO_KEY[slug];
  return null;
}

/** True when the input maps to a canonical, supported genre key. */
export function isSupportedGenre(key) {
  return normalizeGenre(key) !== null;
}

/** True when the input is a known group key. */
export function isGenreGroup(groupKey) {
  return typeof groupKey === 'string' && GROUP_SET.has(groupKey);
}

/** Genre objects belonging to a group, in taxonomy order. */
export function getGenresByGroup(groupKey) {
  return GENRES_BY_GROUP[groupKey] ? [...GENRES_BY_GROUP[groupKey]] : [];
}

/** The group key for a genre (normalizes input first), or null. */
export function getGroupOf(input) {
  const key = normalizeGenre(input);
  return key ? GROUP_OF[key] : null;
}

/** All canonical genre keys. */
export function getAllGenreKeys() {
  return [...GENRE_KEYS];
}

/** All group keys, in display order. */
export function getGroupKeys() {
  return [...GENRE_GROUPS];
}

/**
 * English display label for an already-canonical genre key (e.g. "hip_hop").
 * Does NOT normalize or accept a locale — callers that may have a legacy/
 * freeform value should normalize first (see getGenreLabel in
 * src/utils/genreLabels.js, which wraps this with normalization + fallback).
 * Returns undefined for an unknown key.
 */
export function getLabelOfKey(key) {
  return LABEL_OF[key];
}

/** English display label for a group key. Returns undefined for an unknown group. */
export function getLabelOfGroup(groupKey) {
  return GROUP_LABELS[groupKey];
}
