import { describe, it, expect } from 'vitest';
import { getGenreLabel, getGenreGroupLabel, searchGenres } from '../genreLabels';

// Genre and genre-group NAMES are always English, regardless of the active UI
// language (en/uk/pl/ru) — see NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md. These
// helpers intentionally have zero i18n coupling: no i18n instance is set up
// or imported anywhere in this file, and passing a language argument (kept
// only for call-site backward compatibility) must not change the result.
describe('genre labels (English-only)', () => {
  it('returns the English label for known genre keys', () => {
    expect(getGenreLabel('hip_hop')).toBe('Hip-Hop');
    expect(getGenreLabel('electronic')).toBe('Electronic');
    expect(getGenreLabel('rnb')).toBe('R&B');
    expect(getGenreLabel('other')).toBe('Other');
  });

  it('ignores a language argument entirely — genre names never localize', () => {
    expect(getGenreLabel('hip_hop', 'en')).toBe('Hip-Hop');
    expect(getGenreLabel('hip_hop', 'uk')).toBe('Hip-Hop');
    expect(getGenreLabel('hip_hop', 'ru')).toBe('Hip-Hop');
    expect(getGenreLabel('hip_hop', 'pl')).toBe('Hip-Hop');
    expect(getGenreLabel('electronic', 'pl')).toBe('Electronic');
    expect(getGenreLabel('electronic', 'uk')).toBe('Electronic');
  });

  it('normalizes legacy/alias values before labeling, regardless of language', () => {
    expect(getGenreLabel('Dark Synth', 'en')).toBe('Synthwave');
    expect(getGenreLabel('Dark Synth', 'uk')).toBe('Synthwave');
    expect(getGenreLabel('Lo-fi', 'en')).toBe('Lo-fi');
    expect(getGenreLabel('Hip Hop', 'uk')).toBe('Hip-Hop');
    expect(getGenreLabel('hip-hop', 'ru')).toBe('Hip-Hop');
    expect(getGenreLabel('R&B', 'pl')).toBe('R&B');
  });

  it('returns the raw value for unknown/custom genres (never crashes, never localized)', () => {
    expect(getGenreLabel('Vinyl Crackle', 'en')).toBe('Vinyl Crackle');
    expect(getGenreLabel('Vinyl Crackle', 'uk')).toBe('Vinyl Crackle');
    expect(getGenreLabel('')).toBe('');
    expect(getGenreLabel(null)).toBe('');
  });

  it('labels genre groups in English only, regardless of language', () => {
    expect(getGenreGroupLabel('urban', 'en')).toBe('Hip-Hop & Urban');
    expect(getGenreGroupLabel('urban', 'uk')).toBe('Hip-Hop & Urban');
    expect(getGenreGroupLabel('urban', 'ru')).toBe('Hip-Hop & Urban');
    expect(getGenreGroupLabel('urban', 'pl')).toBe('Hip-Hop & Urban');
    expect(getGenreGroupLabel('jazz_blues')).toBe('Jazz & Blues');
  });

  it('searches by (English) label, key, and alias — unaffected by language', () => {
    expect(searchGenres('dnb', 'en').map((g) => g.key)).toContain('drum_and_bass');
    expect(searchGenres('r&b', 'en').map((g) => g.key)).toContain('rnb');
    expect(searchGenres('hip_hop', 'uk').map((g) => g.key)).toContain('hip_hop');
    expect(searchGenres('phonk').map((g) => g.key)).toContain('phonk');
    // Results always carry the English label, whatever language is passed.
    const hipHop = searchGenres('hip', 'uk').find((g) => g.key === 'hip_hop');
    expect(hipHop.label).toBe('Hip-Hop');
    // empty query returns the full taxonomy
    expect(searchGenres('', 'en').length).toBeGreaterThanOrEqual(80);
  });
});
