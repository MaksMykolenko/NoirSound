'use strict';

const MAX_LYRICS_CHARACTERS = 50_000;
const MAX_LYRICS_LINES = 1_000;
const LYRICS_TYPES = new Set(['NONE', 'PLAIN', 'SYNCED']);
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const HTML_TAG_PATTERN = /<\s*\/?\s*[a-z][^>]*>/i;
const SCRIPT_PATTERN = /<\s*\/?\s*script\b|javascript\s*:|on(?:error|load)\s*=/i;

function validationFailure(error, message) {
  return { ok: false, error, message };
}

function normalizeLyricsText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function normalizeLyricsLanguage(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const [base, region] = value.trim().split('-');
  if (!base) return null;
  return region ? `${base.toLowerCase()}-${region.toUpperCase()}` : base.toLowerCase();
}

function validateText(text) {
  if (text.length > MAX_LYRICS_CHARACTERS) {
    return validationFailure(
      'LYRICS_TOO_LONG',
      `Lyrics must be at most ${MAX_LYRICS_CHARACTERS} characters.`
    );
  }
  if (text && text.split('\n').length > MAX_LYRICS_LINES) {
    return validationFailure(
      'LYRICS_TOO_LONG',
      `Lyrics must contain at most ${MAX_LYRICS_LINES} lines.`
    );
  }
  const hasDisallowedControl = [...text].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10;
  });
  if (hasDisallowedControl
      || HTML_TAG_PATTERN.test(text)
      || SCRIPT_PATTERN.test(text)) {
    return validationFailure(
      'LYRICS_INVALID_FORMAT',
      'Lyrics must be plain text without HTML or script content.'
    );
  }
  return null;
}

function validateSyncedLyrics(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_LYRICS_LINES) {
    return validationFailure(
      'LYRICS_SYNC_INVALID',
      `Synced lyrics must contain between 1 and ${MAX_LYRICS_LINES} timed lines.`
    );
  }
  let previousTime = -1;
  const normalized = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return validationFailure('LYRICS_SYNC_INVALID', 'Every synced lyric line must be an object.');
    }
    const time = Number(entry.time);
    const text = normalizeLyricsText(entry.text);
    if (!Number.isFinite(time) || time < 0 || time < previousTime || !text) {
      return validationFailure(
        'LYRICS_SYNC_INVALID',
        'Synced lyric times must be finite, non-negative, ordered, and include text.'
      );
    }
    const textError = validateText(text);
    if (textError) {
      return validationFailure('LYRICS_SYNC_INVALID', textError.message);
    }
    normalized.push({ time, text });
    previousTime = time;
  }
  return { ok: true, data: normalized };
}

function validateLyricsPayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return validationFailure('LYRICS_INVALID_FORMAT', 'Lyrics metadata must be an object.');
  }
  if (payload.lyricsText !== undefined && payload.lyricsText !== null
      && typeof payload.lyricsText !== 'string') {
    return validationFailure('LYRICS_INVALID_FORMAT', 'Lyrics text must be a string.');
  }

  const lyricsText = normalizeLyricsText(payload.lyricsText);
  const textError = validateText(lyricsText);
  if (textError) return textError;

  const requestedType = payload.lyricsType || (lyricsText ? 'PLAIN' : 'NONE');
  if (typeof requestedType !== 'string' || !LYRICS_TYPES.has(requestedType)) {
    return validationFailure('LYRICS_INVALID_FORMAT', 'Lyrics type must be NONE, PLAIN, or SYNCED.');
  }
  if (lyricsText && requestedType === 'NONE') {
    return validationFailure(
      'LYRICS_INVALID_FORMAT',
      'Lyrics type cannot be NONE when lyrics text is provided.'
    );
  }

  const lyricsLanguage = normalizeLyricsLanguage(payload.lyricsLanguage);
  if (payload.lyricsLanguage && (!lyricsLanguage || !LANGUAGE_PATTERN.test(lyricsLanguage))) {
    return validationFailure(
      'LYRICS_INVALID_FORMAT',
      'Lyrics language must be an ISO-like language code such as en or en-US.'
    );
  }

  let lyricsSynced = null;
  if (requestedType === 'SYNCED') {
    const syncedResult = validateSyncedLyrics(payload.lyricsSynced);
    if (!syncedResult.ok) return syncedResult;
    lyricsSynced = syncedResult.data;
  } else if (payload.lyricsSynced !== undefined && payload.lyricsSynced !== null) {
    return validationFailure(
      'LYRICS_SYNC_INVALID',
      'Timed lyric lines are only accepted when lyricsType is SYNCED.'
    );
  }

  const hasLyrics = Boolean(lyricsText || lyricsSynced?.length);
  if (hasLyrics && payload.lyricsRightsConfirmed !== true) {
    return validationFailure(
      'LYRICS_RIGHTS_REQUIRED',
      'Confirm that you own these lyrics or have permission to publish them.'
    );
  }
  if (!hasLyrics && requestedType === 'SYNCED') {
    return validationFailure('LYRICS_SYNC_INVALID', 'Synced lyrics cannot be empty.');
  }

  return {
    ok: true,
    data: {
      lyricsText: hasLyrics ? lyricsText || null : null,
      lyricsType: hasLyrics ? requestedType : 'NONE',
      lyricsLanguage: hasLyrics ? lyricsLanguage : null,
      lyricsSynced: hasLyrics && requestedType === 'SYNCED' ? lyricsSynced : null,
      lyricsRightsConfirmed: hasLyrics,
      hasLyrics
    }
  };
}

function hasLyrics(track) {
  return Boolean(
    track
    && track.lyricsRightsConfirmed === true
    && (track.lyricsText?.trim() || (Array.isArray(track.lyricsSynced) && track.lyricsSynced.length > 0))
  );
}

function serializeLyrics(track) {
  const available = hasLyrics(track);
  if (!available) {
    return { trackId: track.id, hasLyrics: false };
  }
  return {
    trackId: track.id,
    hasLyrics: true,
    lyricsType: track.lyricsType,
    lyricsText: track.lyricsText || '',
    lyricsLanguage: track.lyricsLanguage || null,
    ...(track.lyricsType === 'SYNCED' ? { lyricsSynced: track.lyricsSynced } : {}),
    lyricsUpdatedAt: track.lyricsUpdatedAt
  };
}

module.exports = {
  LYRICS_TYPES,
  MAX_LYRICS_CHARACTERS,
  MAX_LYRICS_LINES,
  hasLyrics,
  normalizeLyricsLanguage,
  normalizeLyricsText,
  serializeLyrics,
  validateLyricsPayload,
  validateSyncedLyrics
};
