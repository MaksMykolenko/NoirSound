'use strict';

const {
  getGenresByGroup,
  getGroupKeys,
  normalizeGenre,
} = require('../constants/musicGenres');

const DISCOVER_SORTS = Object.freeze(['recent', 'played', 'trending']);
const BEAT_BPM_RANGES = Object.freeze({
  'under-90': { gte: 40, lt: 90 },
  '90-119': { gte: 90, lte: 119 },
  '120-149': { gte: 120, lte: 149 },
  '150-plus': { gte: 150, lte: 240 },
});

function parsePositiveInteger(value, { defaultValue, max, field }) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: defaultValue };
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return {
      ok: false,
      error: 'DISCOVER_QUERY_INVALID',
      message: `${field} must be a positive integer.`,
    };
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    return {
      ok: false,
      error: 'DISCOVER_QUERY_INVALID',
      message: `${field} must be between 1 and ${max}.`,
    };
  }
  return { ok: true, value: parsed };
}

function parseShortText(value, field) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string' || value.trim().length > 80) {
    return {
      ok: false,
      error: 'DISCOVER_QUERY_INVALID',
      message: `${field} must be a string no longer than 80 characters.`,
    };
  }
  return { ok: true, value: value.trim() || null };
}

function parseDiscoverQuery(query = {}) {
  const rawSort = query.sort == null || query.sort === ''
    ? 'recent'
    : String(query.sort).trim().toLowerCase();
  if (!DISCOVER_SORTS.includes(rawSort)) {
    return {
      ok: false,
      error: 'DISCOVER_SORT_INVALID',
      message: 'Sort must be recent, played, or trending.',
    };
  }

  const limit = parsePositiveInteger(query.limit, {
    defaultValue: 20,
    max: 60,
    field: 'limit',
  });
  if (!limit.ok) return limit;

  const page = parsePositiveInteger(query.page, {
    defaultValue: 1,
    max: 1000,
    field: 'page',
  });
  if (!page.ok) return page;

  const bpm = query.bpm == null || query.bpm === ''
    ? null
    : String(query.bpm).trim().toLowerCase();
  if (bpm && !Object.prototype.hasOwnProperty.call(BEAT_BPM_RANGES, bpm)) {
    return {
      ok: false,
      error: 'BEAT_BPM_FILTER_INVALID',
      message: 'BPM must be under-90, 90-119, 120-149, or 150-plus.',
    };
  }

  const textFilters = {};
  for (const field of ['style', 'mood', 'key']) {
    const result = parseShortText(query[field], field);
    if (!result.ok) return result;
    textFilters[field] = result.value;
  }

  const rawGenre = parseShortText(query.genre, 'genre');
  if (!rawGenre.ok) return rawGenre;
  const genre = rawGenre.value ? normalizeGenre(rawGenre.value) : null;
  if (rawGenre.value && !genre) {
    return {
      ok: false,
      error: 'DISCOVER_GENRE_FILTER_INVALID',
      message: 'Genre must be a supported NoirSound genre.',
    };
  }

  const rawGroup = parseShortText(query.group, 'group');
  if (!rawGroup.ok) return rawGroup;
  const group = rawGroup.value;
  if (group && !getGroupKeys().includes(group)) {
    return {
      ok: false,
      error: 'DISCOVER_GENRE_GROUP_INVALID',
      message: 'Group must be a supported NoirSound genre group.',
    };
  }
  if (genre && group) {
    return {
      ok: false,
      error: 'DISCOVER_TAXONOMY_FILTER_CONFLICT',
      message: 'Use either genre or group, not both.',
    };
  }

  return {
    ok: true,
    value: {
      sort: rawSort,
      limit: limit.value,
      page: page.value,
      skip: (page.value - 1) * limit.value,
      bpm,
      bpmWhere: bpm ? BEAT_BPM_RANGES[bpm] : null,
      genre,
      group: group || null,
      groupGenres: group ? getGenresByGroup(group).map((item) => item.key) : null,
      ...textFilters,
    },
  };
}

module.exports = {
  BEAT_BPM_RANGES,
  DISCOVER_SORTS,
  parseDiscoverQuery,
};
