import { describe, it, expect } from 'vitest';
import taxonomy from '../src/constants/musicGenres.js';
import uploadsRoutes from '../src/routes/uploads.js';
import seedModule from '../prisma/seed.js';

const { normalizeGenre, isSupportedGenre, getAllGenreKeys, getGroupKeys, MUSIC_GENRES, GROUP_LABELS, getLabelOfKey, getLabelOfGroup } = taxonomy;
const { validateInitBody } = uploadsRoutes;
const { DEMO_TRACKS, DEMO_ARTISTS, MINIMAL_USERS } = seedModule;

const baseBody = (genre) => ({
  title: 'A Track',
  description: 'desc',
  genre,
  tags: ['dark', 'underground'],
  copyrightConfirmed: true,
  audio: { filename: 'song.mp3', mimeType: 'audio/mpeg', sizeBytes: 1024 },
  cover: { filename: 'cover.png', mimeType: 'image/png', sizeBytes: 1024 },
});

describe('backend genre taxonomy', () => {
  it('shares a broad taxonomy with stable keys', () => {
    expect(getGroupKeys().length).toBeGreaterThanOrEqual(14);
    expect(getAllGenreKeys().length).toBeGreaterThanOrEqual(80);
    for (const key of ['pop', 'hip_hop', 'rock', 'jazz', 'classical', 'world', 'phonk']) {
      expect(getAllGenreKeys()).toContain(key);
    }
  });

  it('normalizes legacy values and rejects roles', () => {
    expect(normalizeGenre('Dark Synth')).toBe('synthwave');
    expect(normalizeGenre('Hip Hop')).toBe('hip_hop');
    expect(isSupportedGenre('ADMIN')).toBe(false);
    expect(isSupportedGenre('LISTENER')).toBe(false);
  });
});

describe('backend genre labels are English-only data, not translations', () => {
  it('every genre and group carries a non-empty English label on the taxonomy itself', () => {
    for (const genre of MUSIC_GENRES) {
      expect(typeof genre.label).toBe('string');
      expect(genre.label.length).toBeGreaterThan(0);
    }
    for (const group of getGroupKeys()) {
      expect(typeof GROUP_LABELS[group]).toBe('string');
      expect(GROUP_LABELS[group].length).toBeGreaterThan(0);
    }
    expect(getLabelOfKey('hip_hop')).toBe('Hip-Hop');
    expect(getLabelOfGroup('urban')).toBe('Hip-Hop & Urban');
  });

  it('the taxonomy label lookups have no request-language/locale parameter at all', () => {
    // The backend must never be able to return a per-request-language label:
    // there is no lng/locale argument anywhere on the taxonomy API surface.
    expect(getLabelOfKey.length).toBe(1); // (key) — no language arg
    expect(getLabelOfGroup.length).toBe(1); // (groupKey) — no language arg
  });
});

describe('upload genre validation', () => {
  it('accepts supported genre keys', () => {
    expect(validateInitBody(baseBody('phonk'))).toBeNull();
    expect(validateInitBody(baseBody('hip_hop'))).toBeNull();
    expect(validateInitBody(baseBody('classical'))).toBeNull();
  });

  it('accepts legacy display values by normalizing them', () => {
    expect(validateInitBody(baseBody('Hip-Hop'))).toBeNull();
    expect(validateInitBody(baseBody('Dark Synth'))).toBeNull();
  });

  it('accepts the "other" escape hatch (niche styles go in tags)', () => {
    expect(validateInitBody(baseBody('other'))).toBeNull();
  });

  it('rejects unsupported genres and role-like values', () => {
    expect(validateInitBody(baseBody('banana'))).toMatch(/Unsupported genre/);
    expect(validateInitBody(baseBody('ADMIN'))).toMatch(/Unsupported genre/);
    expect(validateInitBody(baseBody(''))).toBeTruthy();
  });
});

describe('seed genres', () => {
  it('demo seed only uses valid canonical genre keys', () => {
    for (const t of DEMO_TRACKS) {
      expect(isSupportedGenre(t.genre)).toBe(true);
      expect(normalizeGenre(t.genre)).toBe(t.genre); // already canonical
    }
    for (const a of DEMO_ARTISTS) {
      for (const g of a.genres) expect(isSupportedGenre(g)).toBe(true);
    }
  });

  it('minimal seed artist profile uses valid canonical genre keys', () => {
    for (const g of MINIMAL_USERS.artist.genres) {
      expect(isSupportedGenre(g)).toBe(true);
      expect(normalizeGenre(g)).toBe(g);
    }
  });
});
