import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../client';
import { getCatalogTracks, getTracks, searchTracks } from '../real/tracks';

vi.mock('../client', () => ({ apiFetch: vi.fn(), API_BASE_URL: 'http://localhost:3000/api' }));
const track = { id: 'outside-first-sixty', title: 'Authored title', artistId: 'creator', artist: { user: { displayName: 'Public creator' } }, contentType: 'BEAT', beatBpm: 132, beatKey: 'F# Minor', plays: 900, rankingScore: 7, isStreamable: true, hasLyrics: true, lyricsType: 'PLAIN', tags: ['exact-search'] };
const response = () => ({ items: [track], total: 160, pageInfo: { nextCursor: 'opaque-continuation', hasNextPage: true, pageSize: 30 }, facets: { genres: [], groups: [], styles: [], moods: [], keys: [], bpmRanges: [] }, meta: { sort: 'trending', trendingWindowDays: 7 } });

beforeEach(() => vi.clearAllMocks());
describe('real catalog API adapter', () => {
  it('encodes Unicode and special characters, forwards every filter and cancellation signal, and maps lightweight Tracks', async () => {
    apiFetch.mockResolvedValue(response());
    const controller = new AbortController();
    const result = await getCatalogTracks({ q: '  Łódź Нічний "%_#"  ', contentType: 'BEAT', genre: 'hip_hop', style: 'Trap', mood: 'Dark', bpmMin: 120, bpmMax: 149, key: 'F# Minor', sort: 'trending', cursor: 'opaque+cursor/#', limit: 30 }, { signal: controller.signal });
    const [endpoint, options] = apiFetch.mock.calls[0];
    const url = new URL(endpoint, 'http://test.local');
    expect(url.pathname).toBe('/discover/catalog');
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'Łódź Нічний "%_#"', contentType: 'BEAT', genre: 'hip_hop', style: 'Trap', mood: 'Dark', bpmMin: '120', bpmMax: '149', key: 'F# Minor', sort: 'trending', cursor: 'opaque+cursor/#', limit: '30' });
    expect(options.signal).toBe(controller.signal);
    expect(result.total).toBe(160);
    expect(result.items[0]).toMatchObject({ id: track.id, title: track.title, artistName: 'Public creator', contentType: 'BEAT', beatKey: 'F# Minor', plays: 900, rankingScore: 7, audioUrl: 'http://localhost:3000/api/tracks/outside-first-sixty/stream', hasLyrics: true });
  });

  it('searches server-side before the page and does not second-guess a valid server match', async () => {
    apiFetch.mockResolvedValue(response());
    const results = await searchTracks('a matching featured credit', { contentType: 'BEAT', limit: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(track.id);
    expect(new URL(apiFetch.mock.calls[0][0], 'http://test.local').searchParams.get('q')).toBe('a matching featured credit');
  });

  it('keeps the legacy getTracks array contract unchanged', async () => {
    apiFetch.mockResolvedValue({ data: [track], pagination: { total: 160 } });
    const result = await getTracks({ contentType: 'BEAT' });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe(track.id);
    expect(apiFetch.mock.calls[0][0]).toBe('/tracks?contentType=BEAT');
  });

  it('treats whitespace search as empty and omits the All content filter', async () => {
    apiFetch.mockResolvedValue(response());
    await getCatalogTracks({ q: ' \t\n ', contentType: 'ALL', limit: 30 });
    const params = new URL(apiFetch.mock.calls[0][0], 'http://test.local').searchParams;
    expect(params.has('q')).toBe(false);
    expect(params.has('contentType')).toBe(false);
  });

  it('rejects a malformed response instead of silently inventing an empty catalog or zero counts', async () => {
    apiFetch.mockResolvedValue({ data: [], total: 0 });
    await expect(getCatalogTracks()).rejects.toThrow('Invalid catalog response');
  });
});
