import { describe, expect, it } from 'vitest';
import {
  MAX_LYRICS_CHARACTERS,
  MAX_LYRICS_LINES,
  normalizeLyricsText,
  serializeLyrics,
  validateLyricsPayload,
  validateSyncedLyrics,
} from '../src/lib/lyrics';

describe('lyrics validation', () => {
  it('keeps lyrics optional and resets rights when content is removed', () => {
    expect(validateLyricsPayload({})).toEqual({
      ok: true,
      data: {
        lyricsText: null,
        lyricsType: 'NONE',
        lyricsLanguage: null,
        lyricsSynced: null,
        lyricsRightsConfirmed: false,
        hasLyrics: false,
      },
    });
  });

  it('normalizes line endings while preserving intentional line breaks', () => {
    const result = validateLyricsPayload({
      lyricsText: '\r\nFirst line\r\n\r\nSecond line\r\n',
      lyricsType: 'PLAIN',
      lyricsLanguage: 'EN-us',
      lyricsRightsConfirmed: true,
    });
    expect(result.ok).toBe(true);
    expect(result.data.lyricsText).toBe('First line\n\nSecond line');
    expect(result.data.lyricsLanguage).toBe('en-US');
    expect(normalizeLyricsText('  first\nsecond  ')).toBe('first\nsecond');
  });

  it('requires separate rights confirmation for non-empty lyrics', () => {
    expect(validateLyricsPayload({
      lyricsText: 'Original line',
      lyricsType: 'PLAIN',
      lyricsRightsConfirmed: false,
    })).toMatchObject({ ok: false, error: 'LYRICS_RIGHTS_REQUIRED' });
  });

  it('enforces character and line limits with stable errors', () => {
    expect(validateLyricsPayload({
      lyricsText: 'x'.repeat(MAX_LYRICS_CHARACTERS + 1),
      lyricsRightsConfirmed: true,
    })).toMatchObject({ ok: false, error: 'LYRICS_TOO_LONG' });
    expect(validateLyricsPayload({
      lyricsText: Array.from({ length: MAX_LYRICS_LINES + 1 }, () => 'line').join('\n'),
      lyricsRightsConfirmed: true,
    })).toMatchObject({ ok: false, error: 'LYRICS_TOO_LONG' });
  });

  it('rejects HTML and script-like content rather than rendering it', () => {
    for (const lyricsText of [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
    ]) {
      expect(validateLyricsPayload({
        lyricsText,
        lyricsRightsConfirmed: true,
      })).toMatchObject({ ok: false, error: 'LYRICS_INVALID_FORMAT' });
    }
  });

  it('validates the future synced lyric structure', () => {
    expect(validateSyncedLyrics([
      { time: 0, text: 'First line' },
      { time: 12.4, text: 'Second line' },
    ])).toMatchObject({ ok: true });
    expect(validateSyncedLyrics([
      { time: 5, text: 'Later' },
      { time: 4, text: 'Out of order' },
    ])).toMatchObject({ ok: false, error: 'LYRICS_SYNC_INVALID' });
  });

  it('serializes only rights-confirmed lyrics', () => {
    expect(serializeLyrics({
      id: 'track-1',
      lyricsText: 'Line',
      lyricsType: 'PLAIN',
      lyricsLanguage: 'en',
      lyricsRightsConfirmed: true,
      lyricsUpdatedAt: new Date('2026-07-05T00:00:00Z'),
    })).toMatchObject({
      trackId: 'track-1',
      hasLyrics: true,
      lyricsText: 'Line',
    });
    expect(serializeLyrics({
      id: 'track-2',
      lyricsText: 'Unconfirmed',
      lyricsType: 'PLAIN',
      lyricsRightsConfirmed: false,
    })).toEqual({ trackId: 'track-2', hasLyrics: false });
  });
});
