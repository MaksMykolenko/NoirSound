// Canonical music-genre taxonomy (backend CommonJS view).
//
// Reads the SAME shared/musicGenres.json that the frontend consumes, so the set
// of supported genre keys can never drift between client and server.
//
// The database stores the stable snake_case `key`. Display labels are a frontend
// i18n concern and must never be written to the database.

const fs = require('fs');
const path = require('path');

let taxonomy;
const rootShared = path.resolve(__dirname, '../../../shared/musicGenres.json');
const srcShared = path.resolve(__dirname, '../shared/musicGenres.json');

if (fs.existsSync(rootShared)) {
  taxonomy = require(rootShared);
} else if (fs.existsSync(srcShared)) {
  taxonomy = require(srcShared);
} else {
  taxonomy = require('../shared/musicGenres.json');
}

const GENRE_GROUPS = taxonomy.groups.slice();
const MUSIC_GENRES = taxonomy.genres.map((g) => ({ ...g, aliases: g.aliases.slice() }));
const GENRE_KEYS = MUSIC_GENRES.map((g) => g.key);

const KEY_SET = new Set(GENRE_KEYS);

const GENRES_BY_GROUP = MUSIC_GENRES.reduce((acc, g) => {
  (acc[g.group] = acc[g.group] || []).push(g);
  return acc;
}, {});

const GROUP_OF = MUSIC_GENRES.reduce((acc, g) => {
  acc[g.key] = g.group;
  return acc;
}, {});

const SLUG_TO_KEY = {};
for (const g of MUSIC_GENRES) {
  for (const token of [g.key].concat(g.aliases)) {
    SLUG_TO_KEY[slugifyGenre(token)] = g.key;
  }
}

function slugifyGenre(input) {
  if (input == null) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeGenre(input) {
  if (input == null) return null;
  const slug = slugifyGenre(input);
  if (!slug) return null;
  if (KEY_SET.has(slug)) return slug;
  if (SLUG_TO_KEY[slug]) return SLUG_TO_KEY[slug];
  return null;
}

function isSupportedGenre(key) {
  return normalizeGenre(key) !== null;
}

function getGenresByGroup(groupKey) {
  return GENRES_BY_GROUP[groupKey] ? GENRES_BY_GROUP[groupKey].slice() : [];
}

function getGroupOf(input) {
  const key = normalizeGenre(input);
  return key ? GROUP_OF[key] : null;
}

function getAllGenreKeys() {
  return GENRE_KEYS.slice();
}

function getGroupKeys() {
  return GENRE_GROUPS.slice();
}

module.exports = {
  GENRE_GROUPS,
  MUSIC_GENRES,
  GENRE_KEYS,
  slugifyGenre,
  normalizeGenre,
  isSupportedGenre,
  getGenresByGroup,
  getGroupOf,
  getAllGenreKeys,
  getGroupKeys,
};
