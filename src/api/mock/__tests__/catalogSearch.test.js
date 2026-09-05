import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCatalogTracks } from '../tracks';

const { mockTracks } = vi.hoisted(() => ({ mockTracks: [] }));
vi.mock('../data', () => ({ mockTracks }));

const track = (id, fields = {}) => ({
  id,
  title: `Release ${id}`,
  artistName: 'Public artist',
  contentType: 'MUSIC',
  genre: 'rock',
  status: 'PUBLISHED',
  isPublic: true,
  tags: [],
  ...fields,
});

beforeEach(() => mockTracks.splice(0, mockTracks.length, track('ordinary-rock')));

describe('demo catalog search semantics', () => {
  it.each(['rock%', '#rock', 'rock\\', '_rock_', '"rock"'])('keeps punctuation literal for %s instead of expanding to the Rock genre', async (q) => {
    const result = await getCatalogTracks({ q });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.facets.genres).toEqual([]);
  });

  it.each([
    ['rock%', { title: 'Live rock% recording' }],
    ['#rock', { tags: ['#rock'] }],
    ['rock\\', { primaryArtistName: 'rock\\ credits' }],
    ['_rock_', { featuredArtists: ['_rock_ guest'] }],
    ['"rock"', { title: 'Literal "rock" release' }],
  ])('finds literal %s in public metadata without matching plain Rock records', async (q, fields) => {
    mockTracks.push(track('literal', fields));
    const result = await getCatalogTracks({ q });
    expect(result.items.map((item) => item.id)).toEqual(['literal']);
    expect(result.total).toBe(1);
    expect(result.facets.genres).toEqual([{ value: 'rock', label: 'Rock', count: 1 }]);
  });

  it.each(['hip_hop', 'Hip-Hop', '  HIP   HOP  '])('finds canonical genre records through supported key, label, or alias %s', async (q) => {
    mockTracks.push(track('urban', { genre: 'hip_hop' }));
    const result = await getCatalogTracks({ q });
    expect(result.items.map((item) => item.id)).toEqual(['urban']);
    expect(result.total).toBe(1);
  });

  it.each([
    ['żółw', { primaryArtistName: 'Producer Żółw' }],
    ['київ', { featuredArtists: ['Guest Київ'] }],
  ])('searches multilingual public artist credits for %s', async (q, fields) => {
    mockTracks.push(track('credited', fields));
    const result = await getCatalogTracks({ q });
    expect(result.items.map((item) => item.id)).toEqual(['credited']);
    expect(result.total).toBe(1);
  });
});
