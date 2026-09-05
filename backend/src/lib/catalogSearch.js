'use strict';

const { createHash } = require('node:crypto');
const { Prisma } = require('@prisma/client');
const { MUSIC_GENRES, GENRE_GROUPS, GROUP_LABELS, getGenresByGroup, getGroupOf, getGenreFilterValues, normalizeGenre } = require('../constants/musicGenres');
const { normalizeBeatKey, publicBeatMetadata } = require('./beatMetadata');
const { publicTrackSql } = require('./publicVisibility');

const SORTS = Object.freeze(['recent', 'played', 'liked', 'trending']);
const BPM_RANGES = Object.freeze({ 'under-90': [40, 89], '90-119': [90, 119], '120-149': [120, 149], '150-plus': [150, 240] });
const PARAMS = new Set(['q', 'contentType', 'genre', 'group', 'style', 'mood', 'key', 'bpm', 'bpmMin', 'bpmMax', 'sort', 'limit', 'cursor']);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FROM = Prisma.sql`FROM "Track" t JOIN "ArtistProfile" a ON a.id = t."artistId" JOIN "User" u ON u.id = a."userId"`;

function invalid(message, field, error = 'CATALOG_QUERY_INVALID') {
  return { ok: false, error, message, ...(field ? { field } : {}) };
}

function parseCatalogQuery(query = {}) {
  for (const [name, value] of Object.entries(query)) {
    if (!PARAMS.has(name)) return invalid(`Unsupported catalog parameter: ${name}.`, name);
    if (typeof value !== 'string') return invalid(`${name} must be one string value.`, name);
    if (Array.from(value).some(character => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
    })) return invalid(`${name} contains unsupported control characters.`, name);
  }
  const text = name => query[name]?.normalize('NFC').trim() || null;
  const q = text('q')?.replace(/\s+/gu, ' ') || null;
  if (q && q.length > 120) return invalid('Search query must be at most 120 characters.', 'q');
  const sort = text('sort')?.toLowerCase() || 'recent';
  if (!SORTS.includes(sort)) return invalid('Sort must be recent, played, liked, or trending.', 'sort');
  const content = text('contentType')?.toUpperCase() || 'ALL';
  if (!['ALL', 'MUSIC', 'BEAT'].includes(content)) return invalid('contentType must be MUSIC, BEAT, or ALL.', 'contentType');
  const genre = text('genre') ? normalizeGenre(text('genre')) : null;
  if (text('genre') && !genre) return invalid('Genre must belong to the NoirSound taxonomy.', 'genre');
  const group = text('group');
  if (group && !GENRE_GROUPS.includes(group)) return invalid('Group must belong to the NoirSound taxonomy.', 'group');
  if (genre && group) return invalid('Use either genre or group, not both.', 'group');
  const filters = { q, contentType: content === 'ALL' ? null : content, genre, group, sort };
  for (const field of ['style', 'mood']) {
    if (text(field)?.length > 80) return invalid(`${field} must be at most 80 characters.`, field);
    filters[field] = text(field);
  }
  const key = normalizeBeatKey(text('key'));
  if (!key.ok) return invalid(key.message, 'key');
  filters.key = key.value;
  const bpm = text('bpm');
  if (bpm && !Object.hasOwn(BPM_RANGES, bpm)) return invalid('Unsupported BPM range.', 'bpm');
  if (bpm && (text('bpmMin') || text('bpmMax'))) return invalid('Use bpm or bpmMin/bpmMax, not both.', 'bpm');
  for (const [name, minimum, maximum, fallback] of [['limit', 1, 100, 30], ['bpmMin', 40, 240, null], ['bpmMax', 40, 240, null]]) {
    const raw = text(name);
    if (raw && (!/^\d+$/u.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < minimum || Number(raw) > maximum)) return invalid(`${name} must be an integer from ${minimum} to ${maximum}.`, name);
    filters[name] = raw ? Number(raw) : fallback;
  }
  if (bpm) [filters.bpmMin, filters.bpmMax] = BPM_RANGES[bpm];
  if (filters.bpmMin !== null && filters.bpmMax !== null && filters.bpmMin > filters.bpmMax) return invalid('bpmMin must not exceed bpmMax.', 'bpmMin');
  if ((filters.style || filters.mood || filters.key || filters.bpmMin !== null || filters.bpmMax !== null) && content !== 'BEAT') return invalid('Beat filters require contentType=BEAT.', 'contentType', 'BEAT_FILTER_REQUIRES_BEAT_CONTENT');
  const cursor = text('cursor');
  if (cursor && (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/u.test(cursor))) return invalid('Malformed catalog cursor.', 'cursor', 'CATALOG_CURSOR_INVALID');
  return { ok: true, value: { ...filters, cursor } };
}

function queryFingerprint(filters) {
  return createHash('sha256').update(JSON.stringify([
    filters.q?.toLowerCase() || null, filters.contentType, filters.genre, filters.group,
    filters.style?.toLowerCase() || null, filters.mood?.toLowerCase() || null,
    filters.key, filters.bpmMin, filters.bpmMax, filters.sort,
  ])).digest('hex');
}

function decodeCatalogCursor(filters, now = new Date()) {
  if (!filters.cursor) return { ok: true, value: null, asOf: now };
  try {
    const cursor = JSON.parse(Buffer.from(filters.cursor, 'base64url').toString('utf8'));
    if (!cursor || Object.keys(cursor).sort().join(',') !== 'asOf,date,hash,id,rank,v' || cursor.v !== 1
        || cursor.hash !== queryFingerprint(filters) || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 128
        || Array.from(cursor.id).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || !Number.isSafeInteger(cursor.rank) || cursor.rank < 0
        || (cursor.date !== null && (typeof cursor.date !== 'string' || new Date(cursor.date).toISOString() !== cursor.date))
        || typeof cursor.asOf !== 'string' || new Date(cursor.asOf).toISOString() !== cursor.asOf
        || new Date(cursor.asOf) > new Date(now.getTime() + 60000)) throw new Error('invalid');
    return { ok: true, value: cursor, asOf: new Date(cursor.asOf) };
  } catch {
    return invalid('Cursor is invalid or belongs to a different search/filter/sort.', 'cursor', 'CATALOG_CURSOR_INVALID');
  }
}

function encodeCatalogCursor(filters, row, asOf) {
  return Buffer.from(JSON.stringify({ v: 1, hash: queryFingerprint(filters), rank: Number(row._rank), date: row.publishedAt?.toISOString() || null, id: row.id, asOf: asOf.toISOString() })).toString('base64url');
}

function escapedContains(value) {
  return `%${value.replace(/[\\%_]/gu, '\\$&')}%`;
}

function catalogWhere(filters, omit = null) {
  const parts = [publicTrackSql()];
  if (filters.contentType) parts.push(Prisma.sql`t."contentType" = ${filters.contentType}::"TrackContentType"`);
  if (filters.q) {
    const pattern = escapedContains(filters.q);
    // Search is literal even when a phrase resembles a genre. The taxonomy's
    // own keys/labels/aliases expand matches; slugification must not discard
    // user punctuation such as %, #, underscores, or backslashes here.
    const searchGenres = MUSIC_GENRES.filter(item => [item.key, item.label, ...item.aliases]
      .some(value => value.normalize('NFC').replace(/\s+/gu, ' ').toLowerCase().includes(filters.q.toLowerCase())))
      .map(item => item.key);
    const genreMatch = searchGenres.length ? Prisma.sql`OR lower(t.genre) IN (${Prisma.join(getGenreFilterValues(searchGenres))})` : Prisma.empty;
    parts.push(Prisma.sql`(t.title ILIKE ${pattern} OR u."displayName" ILIKE ${pattern} OR u.username ILIKE ${pattern}
      OR t."primaryArtistName" ILIKE ${pattern} OR t."beatStyle" ILIKE ${pattern} OR t."beatMood" ILIKE ${pattern}
      OR t.genre ILIKE ${pattern}
      OR EXISTS (SELECT 1 FROM unnest(t.tags) AS tag WHERE tag ILIKE ${pattern})
      OR EXISTS (SELECT 1 FROM unnest(t."featuredArtists") AS credit WHERE credit ILIKE ${pattern}) ${genreMatch})`);
  }
  if (omit !== 'taxonomy' && (filters.genre || filters.group)) {
    const keys = filters.genre ? [filters.genre] : getGenresByGroup(filters.group).map(item => item.key);
    parts.push(Prisma.sql`lower(t.genre) IN (${Prisma.join(getGenreFilterValues(keys))})`);
  }
  if (omit !== 'style' && filters.style) parts.push(Prisma.sql`lower(btrim(t."beatStyle")) = lower(${filters.style})`);
  if (omit !== 'mood' && filters.mood) parts.push(Prisma.sql`lower(btrim(t."beatMood")) = lower(${filters.mood})`);
  if (omit !== 'key' && filters.key) parts.push(Prisma.sql`lower(btrim(t."beatKey")) = lower(${filters.key})`);
  if (omit !== 'bpm') {
    if (filters.bpmMin !== null) parts.push(Prisma.sql`t."beatBpm" >= ${filters.bpmMin}`);
    if (filters.bpmMax !== null) parts.push(Prisma.sql`t."beatBpm" <= ${filters.bpmMax}`);
  }
  return Prisma.join(parts, ' AND ');
}

function rankSql(sort) {
  if (sort === 'played') return Prisma.sql`t.plays`;
  if (sort === 'liked') return Prisma.sql`t.likes`;
  if (sort === 'trending') return Prisma.sql`COALESCE(weekly.rank, 0)::int`;
  return Prisma.sql`0`;
}

function dateAfterCursor(cursor) {
  if (cursor.date === null) return Prisma.sql`(t."publishedAt" IS NULL AND t.id > ${cursor.id})`;
  const date = new Date(cursor.date);
  return Prisma.sql`(t."publishedAt" < ${date} OR t."publishedAt" IS NULL OR (t."publishedAt" = ${date} AND t.id > ${cursor.id}))`;
}

function catalogPageQuery(filters, cursor, asOf) {
  const rank = rankSql(filters.sort);
  const weekly = filters.sort === 'trending' ? Prisma.sql`LEFT JOIN (
    SELECT p."trackId", count(*)::int AS rank FROM "PlayEvent" p
    WHERE p.qualified = true AND p."createdAt" >= ${new Date(asOf.getTime() - WEEK_MS)} AND p."createdAt" <= ${asOf}
    GROUP BY p."trackId"
  ) weekly ON weekly."trackId" = t.id` : Prisma.empty;
  const after = !cursor ? Prisma.empty : Prisma.sql`AND ${filters.sort === 'recent' ? dateAfterCursor(cursor) : Prisma.sql`(${rank} < ${cursor.rank} OR (${rank} = ${cursor.rank} AND ${dateAfterCursor(cursor)}))`}`;
  const order = filters.sort === 'recent' ? Prisma.sql`t."publishedAt" DESC NULLS LAST, t.id ASC` : Prisma.sql`${rank} DESC, t."publishedAt" DESC NULLS LAST, t.id ASC`;
  return Prisma.sql`SELECT t.id, t.title, t.slug, t."artistId", t."coverUrl", t.genre, t.tags,
    t.duration, t."durationSeconds", t.plays, t.likes, t."releaseDate", t."createdAt", t."publishedAt", t.status,
    t."primaryArtistName", t."featuredArtists", t.explicit, t."contentType", t."beatBpm", t."beatKey", t."beatStyle", t."beatMood", t."beatLicenseType", t."beatContactEnabled",
    (t."coverImageKey" IS NOT NULL AND t."coverImageKey" <> '') AS "hasCoverImage",
    (t."processedAudioKey" IS NOT NULL AND t."processedAudioKey" <> '') AS "isStreamable",
    (t."lyricsRightsConfirmed" = true AND (COALESCE(length(trim(t."lyricsText")),0) > 0 OR CASE WHEN jsonb_typeof(t."lyricsSynced") = 'array' THEN jsonb_array_length(t."lyricsSynced") > 0 ELSE false END)) AS "hasLyrics",
    t."lyricsType", json_build_object('id', a.id, 'user', json_build_object('displayName', u."displayName", 'username', u.username, 'avatarUrl', u."avatarUrl")) AS artist,
    ${rank} AS "_rank"
    ${FROM} ${weekly} WHERE ${catalogWhere(filters)} ${after}
    ORDER BY ${order} LIMIT ${filters.limit + 1}`;
}

function groupedQuery(filters, dimension, column) {
  if (['style', 'mood', 'key'].includes(dimension)) {
    // Dynamic creator-authored values are bounded independently from track
    // pagination. Counts cover the entire match set; a selected rare value is
    // retained even when it is outside the top 100 options.
    return Prisma.sql`WITH grouped AS (
      SELECT lower(btrim(${column})) AS key, min(btrim(${column})) AS value, count(*)::int AS count
      ${FROM} WHERE ${catalogWhere(filters, dimension)} AND ${column} IS NOT NULL AND btrim(${column}) <> ''
      GROUP BY lower(btrim(${column}))
    ), ranked AS (
      SELECT *, row_number() OVER (ORDER BY count DESC, key ASC) AS position FROM grouped
    ) SELECT value, count, (SELECT count(*)::int FROM grouped) AS "optionCount" FROM ranked
      WHERE position <= 100 OR key = lower(${filters[dimension] || ''}) ORDER BY count DESC, key ASC`;
  }
  return Prisma.sql`SELECT ${column} AS value, count(*)::int AS count ${FROM}
    WHERE ${catalogWhere(filters, dimension)} GROUP BY ${column}`;
}

function facetValues(rows) {
  const merged = new Map();
  for (const row of rows) {
    const value = row.value?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    const existing = merged.get(key);
    merged.set(key, { value: existing?.value || value, label: existing?.label || value, count: (existing?.count || 0) + row.count });
  }
  return [...merged.values()].sort((a, b) => a.value.localeCompare(b.value, 'en'));
}

function buildFacets([genres, styles, moods, keys, bpms]) {
  const counts = new Map();
  for (const row of genres) {
    const key = normalizeGenre(row.value);
    if (key) counts.set(key, (counts.get(key) || 0) + row.count);
  }
  const genreValues = MUSIC_GENRES.map(item => ({ value: item.key, label: item.label, count: counts.get(item.key) || 0 }));
  return {
    genres: genreValues,
    groups: GENRE_GROUPS.map(group => ({ value: group, label: GROUP_LABELS[group], count: genreValues.filter(item => getGroupOf(item.value) === group).reduce((sum, item) => sum + item.count, 0) })),
    styles: facetValues(styles), moods: facetValues(moods), keys: facetValues(keys),
    bpmRanges: Object.entries(BPM_RANGES).map(([value, [min, max]]) => ({ value, label: value, count: bpms.filter(row => row.value !== null && row.value >= min && row.value <= max).reduce((sum, row) => sum + row.count, 0) })),
    meta: {
      optionLimit: 100,
      truncated: { styles: (styles[0]?.optionCount || 0) > styles.length, moods: (moods[0]?.optionCount || 0) > moods.length, keys: (keys[0]?.optionCount || 0) > keys.length },
      availableOptions: { styles: styles[0]?.optionCount || 0, moods: moods[0]?.optionCount || 0, keys: keys[0]?.optionCount || 0 },
    },
  };
}

function serializeCatalogTrack(row) {
  const { _rank, ...safe } = row;
  return { ...safe, ...publicBeatMetadata(row), lyricsType: row.hasLyrics ? row.lyricsType : 'NONE', ...(Number.isInteger(_rank) ? { rankingScore: _rank } : {}) };
}

async function searchCatalog(prisma, filters, decoded) {
  return prisma.$transaction(async tx => {
    const [rows, totalRows, ...facetRows] = await Promise.all([
      tx.$queryRaw(catalogPageQuery(filters, decoded.value, decoded.asOf)),
      tx.$queryRaw(Prisma.sql`SELECT count(*)::int AS total ${FROM} WHERE ${catalogWhere(filters)}`),
      tx.$queryRaw(groupedQuery(filters, 'taxonomy', Prisma.sql`t.genre`)),
      tx.$queryRaw(groupedQuery(filters, 'style', Prisma.sql`t."beatStyle"`)),
      tx.$queryRaw(groupedQuery(filters, 'mood', Prisma.sql`t."beatMood"`)),
      tx.$queryRaw(groupedQuery(filters, 'key', Prisma.sql`t."beatKey"`)),
      tx.$queryRaw(groupedQuery(filters, 'bpm', Prisma.sql`t."beatBpm"`)),
    ]);
    const hasNextPage = rows.length > filters.limit;
    const items = rows.slice(0, filters.limit);
    return {
      items: items.map(serializeCatalogTrack), total: totalRows[0].total,
      pageInfo: { nextCursor: hasNextPage ? encodeCatalogCursor(filters, items[items.length - 1], decoded.asOf) : null, hasNextPage, pageSize: filters.limit },
      facets: buildFacets(facetRows),
      meta: { sort: filters.sort, ...(filters.sort === 'trending' ? { trendingWindowDays: 7 } : {}), rankingAsOf: decoded.asOf.toISOString() },
    };
  }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
}

async function discoverArtists(prisma, { contentType = null, limit = 6, now = new Date() } = {}) {
  const typeFilter = contentType ? Prisma.sql`AND t."contentType" = ${contentType}::"TrackContentType"` : Prisma.empty;
  return prisma.$queryRaw(Prisma.sql`WITH visible AS (
    SELECT t.id, t."artistId" ${FROM} WHERE ${publicTrackSql()} ${typeFilter}
  ), scores AS (
    SELECT v."artistId", count(p.id)::int AS score FROM visible v
    LEFT JOIN "PlayEvent" p ON p."trackId" = v.id AND p.qualified = true
      AND p."createdAt" >= ${new Date(now.getTime() - WEEK_MS)} AND p."createdAt" <= ${now}
    GROUP BY v."artistId"
  ) SELECT a.id, a.genres, scores.score AS "discoveryPlays",
    json_build_object('displayName', u."displayName", 'username', u.username, 'avatarUrl', u."avatarUrl") AS "user",
    json_build_object('followers', (SELECT count(*)::int FROM "ArtistFollow" f WHERE f."artistId" = a.id)) AS "_count"
    FROM scores JOIN "ArtistProfile" a ON a.id = scores."artistId" JOIN "User" u ON u.id = a."userId"
    ORDER BY scores.score DESC, a.id ASC LIMIT ${limit}`);
}

module.exports = { SORTS, BPM_RANGES, parseCatalogQuery, queryFingerprint, decodeCatalogCursor, encodeCatalogCursor, escapedContains, catalogWhere, catalogPageQuery, groupedQuery, buildFacets, searchCatalog, discoverArtists };
