import { describe, expect, it } from 'vitest';
import { parseCatalogQuery, decodeCatalogCursor, encodeCatalogCursor, escapedContains, catalogPageQuery } from '../src/lib/catalogSearch';

const parse = query => parseCatalogQuery(query).value;

describe('catalog request contract', () => {
  it('normalizes whitespace, canonical genres, legacy BPM and musical key aliases', () => {
    expect(parse({ q: '  Łódź   Україна  ', contentType: ' beat ', genre: 'hip-hop', bpm: '120-149', key: 'f♯ min' })).toMatchObject({ q: 'Łódź Україна', contentType: 'BEAT', genre: 'hip_hop', bpmMin: 120, bpmMax: 149, key: 'F# Minor', limit: 30, sort: 'recent' });
    expect(parse({ q: ' \t\n', contentType: 'ALL' })).toMatchObject({ q: null, contentType: null });
  });

  it.each([
    { unexpected: 'yes' }, { q: ['first', 'second'] }, { limit: '0' }, { limit: '101' },
    { limit: '30.5' }, { q: 'x'.repeat(121) }, { q: '\u0000' }, { sort: 'viral' },
    { contentType: 'podcast' }, { genre: 'invented' }, { group: 'invented' },
    { genre: 'hip_hop', group: 'urban' }, { contentType: 'BEAT', bpm: 'slow' },
    { contentType: 'BEAT', bpmMin: '39' }, { contentType: 'BEAT', bpmMax: '241' },
    { contentType: 'BEAT', bpmMin: '140', bpmMax: '120' },
    { contentType: 'BEAT', bpm: '120-149', bpmMin: '120' },
    { contentType: 'MUSIC', style: 'Trap' }, { mood: 'Dark' },
    { contentType: 'BEAT', key: 'H Major' }, { contentType: 'BEAT', style: 'x'.repeat(81) },
    { cursor: 'not base64!' },
  ])('rejects unsupported or conflicting input %j', query => {
    expect(parseCatalogQuery(query)).toMatchObject({ ok: false });
  });

  it('escapes literal LIKE metacharacters and parameterizes hostile search text', () => {
    expect(escapedContains('50%_#\\')).toBe('%50\\%\\_#\\\\%');
    const filters = parse({ q: "' OR 1=1 -- %_", sort: 'played' });
    const sql = catalogPageQuery(filters, null, new Date());
    expect(sql.text).not.toContain("' OR 1=1");
    expect(sql.values).toContain("%' OR 1=1 -- \\%\\_%");
  });
});

describe('catalog cursors', () => {
  const now = new Date('2026-09-05T00:00:00.000Z');
  const filters = parse({ contentType: 'BEAT', sort: 'played', q: 'city' });
  const cursor = encodeCatalogCursor(filters, { id: 'late-track', publishedAt: null, _rank: 10 }, now);

  it('preserves a null date and permits a different bounded page size', () => {
    expect(decodeCatalogCursor({ ...filters, cursor, limit: 70 }, now)).toMatchObject({ ok: true, value: { id: 'late-track', date: null, rank: 10 }, asOf: now });
  });
  it.each([{ sort: 'recent' }, { q: 'different' }, { contentType: 'MUSIC' }, { mood: 'Dark' }])('rejects incompatible query state %j', change => {
    expect(decodeCatalogCursor({ ...filters, ...change, cursor }, now)).toMatchObject({ ok: false, error: 'CATALOG_CURSOR_INVALID' });
  });
  it.each(['e30', 'null', 'not-json', Buffer.from(JSON.stringify({ v: 9 })).toString('base64url')])('rejects malformed cursor %s', value => {
    expect(decodeCatalogCursor({ ...filters, cursor: value }, now)).toMatchObject({ ok: false });
  });
});
