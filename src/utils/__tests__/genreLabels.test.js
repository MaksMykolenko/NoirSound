import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../../i18n';
import { getGenreLabel, getGenreGroupLabel, searchGenres } from '../genreLabels';

describe('genre labels (i18n-aware)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('localizes known genre keys across languages', () => {
    expect(getGenreLabel('hip_hop', 'en')).toBe('Hip-Hop');
    expect(getGenreLabel('hip_hop', 'uk')).toBe('Хіп-хоп');
    expect(getGenreLabel('hip_hop', 'ru')).toBe('Хип-хоп');
    expect(getGenreLabel('electronic', 'pl')).toBe('Elektronika');
  });

  it('normalizes legacy values before localizing', () => {
    expect(getGenreLabel('Dark Synth', 'en')).toBe('Synthwave');
    expect(getGenreLabel('Lo-fi', 'en')).toBe('Lo-fi');
    expect(getGenreLabel('Hip Hop', 'uk')).toBe('Хіп-хоп');
  });

  it('returns the raw value for unknown/custom genres (never crashes)', () => {
    expect(getGenreLabel('Vinyl Crackle', 'en')).toBe('Vinyl Crackle');
    expect(getGenreLabel('')).toBe('');
    expect(getGenreLabel(null)).toBe('');
  });

  it('localizes group labels', () => {
    expect(getGenreGroupLabel('urban', 'en')).toBe('Hip-Hop & Urban');
    expect(getGenreGroupLabel('urban', 'uk')).toBe('Хіп-хоп та урбан');
  });

  it('searches by localized label, key, and alias', () => {
    expect(searchGenres('dnb', 'en').map((g) => g.key)).toContain('drum_and_bass');
    expect(searchGenres('r&b', 'en').map((g) => g.key)).toContain('rnb');
    expect(searchGenres('hip_hop', 'en').map((g) => g.key)).toContain('hip_hop');
    expect(searchGenres('phonk', 'en').map((g) => g.key)).toContain('phonk');
    // empty query returns the full taxonomy
    expect(searchGenres('', 'en').length).toBeGreaterThanOrEqual(80);
  });
});
