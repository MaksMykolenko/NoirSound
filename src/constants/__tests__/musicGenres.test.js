import { describe, it, expect } from 'vitest';
import {
  MUSIC_GENRES,
  GENRE_GROUPS,
  GENRE_KEYS,
  normalizeGenre,
  isSupportedGenre,
  getGenresByGroup,
  getGroupOf,
  getAllGenreKeys,
  getGroupKeys,
} from '../musicGenres';

describe('music genre taxonomy', () => {
  it('exposes a broad set of groups and genres (not only dark/ambient/phonk)', () => {
    expect(GENRE_GROUPS.length).toBeGreaterThanOrEqual(14);
    expect(GENRE_KEYS.length).toBeGreaterThanOrEqual(80);
    const breadth = [
      'pop', 'hip_hop', 'rap', 'rnb', 'soul', 'funk', 'rock', 'metal',
      'electronic', 'house', 'techno', 'trance', 'jazz', 'blues', 'folk',
      'country', 'reggae', 'latin', 'classical', 'soundtrack', 'world',
      'experimental', 'phonk', 'lofi', 'ambient',
    ];
    for (const key of breadth) expect(GENRE_KEYS).toContain(key);
  });

  it('assigns every genre to a known group', () => {
    const groups = new Set(GENRE_GROUPS);
    for (const genre of MUSIC_GENRES) expect(groups.has(genre.group)).toBe(true);
    expect(getAllGenreKeys()).toHaveLength(GENRE_KEYS.length);
    expect(getGroupKeys()).toEqual([...GENRE_GROUPS]);
  });

  it('normalizes legacy and freeform values to stable keys', () => {
    expect(normalizeGenre('Phonk')).toBe('phonk');
    expect(normalizeGenre('Dark Synth')).toBe('synthwave');
    expect(normalizeGenre('Hip Hop')).toBe('hip_hop');
    expect(normalizeGenre('hip-hop')).toBe('hip_hop');
    expect(normalizeGenre('Lo-fi')).toBe('lofi');
    expect(normalizeGenre('R&B')).toBe('rnb');
    expect(normalizeGenre('DnB')).toBe('drum_and_bass');
    expect(normalizeGenre('retrowave')).toBe('synthwave');
  });

  it('returns null for unknown genres so callers can fall back safely', () => {
    expect(normalizeGenre('Vinyl Crackle')).toBeNull();
    expect(normalizeGenre('')).toBeNull();
    expect(normalizeGenre(null)).toBeNull();
    expect(normalizeGenre(undefined)).toBeNull();
  });

  it('isSupportedGenre recognizes keys and aliases, rejects junk', () => {
    expect(isSupportedGenre('phonk')).toBe(true);
    expect(isSupportedGenre('Hip-Hop')).toBe(true);
    expect(isSupportedGenre('r&b')).toBe(true);
    expect(isSupportedGenre('zzz')).toBe(false);
  });

  it('never exposes internal roles or statuses as genres', () => {
    const forbidden = [
      'admin', 'listener', 'artist', 'user', 'player', 'system', 'role',
      'active', 'suspended', 'banned', 'deleted',
    ];
    for (const role of forbidden) {
      expect(GENRE_KEYS).not.toContain(role);
      expect(isSupportedGenre(role)).toBe(false);
    }
  });

  it('maps genres to their groups', () => {
    expect(getGroupOf('phonk')).toBe('urban');
    expect(getGroupOf('Dark Synth')).toBe('electronic');
    expect(getGroupOf('Vinyl Crackle')).toBeNull();
    expect(getGenresByGroup('urban').map((g) => g.key)).toContain('rap');
    expect(getGenresByGroup('jazz_blues').map((g) => g.key)).toContain('jazz');
  });
});
