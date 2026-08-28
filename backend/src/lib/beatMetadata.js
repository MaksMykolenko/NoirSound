'use strict';

const BEAT_BPM_INVALID = 'BEAT_BPM_INVALID';
const BEAT_METADATA_INVALID = 'BEAT_METADATA_INVALID';
const MIN_BEAT_BPM = 40;
const MAX_BEAT_BPM = 240;

const BEAT_METADATA_FIELDS = Object.freeze([
  'beatKey',
  'beatBpm',
  'beatMood',
  'beatStyle',
  'beatLicenseType',
  'beatUsageNotes',
  'beatContactEnabled'
]);

const EMPTY_BEAT_METADATA = Object.freeze({
  beatKey: null,
  beatBpm: null,
  beatMood: null,
  beatStyle: null,
  beatLicenseType: null,
  beatUsageNotes: null,
  beatContactEnabled: false
});

function metadataError(message, field) {
  return { ok: false, error: BEAT_METADATA_INVALID, message, field };
}

function optionalPlainText(value, { field, label, maxLength }) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return metadataError(`${label} must be plain text.`, field);
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > maxLength) {
    return metadataError(`${label} must be at most ${maxLength} characters.`, field);
  }
  // Newlines and tabs are useful in usage notes, but markup delimiters and
  // non-printing control bytes are never accepted or persisted.
  const hasUnsafeControlByte = Array.from(trimmed).some((character) => {
    const code = character.charCodeAt(0);
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
  });
  if (trimmed.includes('<') || trimmed.includes('>') || hasUnsafeControlByte) {
    return metadataError(`${label} must be safe plain text without HTML.`, field);
  }
  return { ok: true, value: trimmed };
}

function normalizeBeatKey(value) {
  const text = optionalPlainText(value, {
    field: 'beatKey',
    label: 'Beat key',
    maxLength: 24
  });
  if (!text.ok || text.value === null) return text;

  const normalizedAccidentals = text.value.replace(/♯/gu, '#').replace(/♭/gu, 'b');
  const match = /^([a-g])([#b]?)(?:\s*(major|minor|maj|min|m))?$/iu.exec(normalizedAccidentals);
  if (!match) {
    return metadataError(
      'Beat key must use a musical key such as C, F# Minor, or Bb Major.',
      'beatKey'
    );
  }
  const tonic = `${match[1].toUpperCase()}${match[2] || ''}`;
  const mode = match[3]
    ? ['minor', 'min', 'm'].includes(match[3].toLowerCase()) ? 'Minor' : 'Major'
    : null;
  return { ok: true, value: mode ? `${tonic} ${mode}` : tonic };
}

function validateBeatMetadata(payload = {}, { contentType = 'BEAT' } = {}) {
  if (contentType !== 'BEAT') {
    return { ok: true, data: { ...EMPTY_BEAT_METADATA } };
  }

  let beatBpm = null;
  if (payload.beatBpm !== undefined && payload.beatBpm !== null && payload.beatBpm !== '') {
    if (!Number.isInteger(payload.beatBpm)
        || payload.beatBpm < MIN_BEAT_BPM
        || payload.beatBpm > MAX_BEAT_BPM) {
      return {
        ok: false,
        error: BEAT_BPM_INVALID,
        message: `Beat BPM must be a whole number from ${MIN_BEAT_BPM} to ${MAX_BEAT_BPM}.`,
        field: 'beatBpm'
      };
    }
    beatBpm = payload.beatBpm;
  }

  const beatKey = normalizeBeatKey(payload.beatKey);
  if (!beatKey.ok) return beatKey;

  const textFields = [
    ['beatMood', 'Beat mood', 80],
    ['beatStyle', 'Beat style', 80],
    ['beatLicenseType', 'Beat license type', 80],
    ['beatUsageNotes', 'Beat usage notes', 1000]
  ];
  const textData = {};
  for (const [field, label, maxLength] of textFields) {
    const result = optionalPlainText(payload[field], { field, label, maxLength });
    if (!result.ok) return result;
    textData[field] = result.value;
  }

  if (payload.beatContactEnabled !== undefined
      && typeof payload.beatContactEnabled !== 'boolean') {
    return metadataError('Beat contact availability must be boolean.', 'beatContactEnabled');
  }

  return {
    ok: true,
    data: {
      beatKey: beatKey.value,
      beatBpm,
      ...textData,
      beatContactEnabled: payload.beatContactEnabled === true
    }
  };
}

function publicBeatMetadata(track) {
  const contentType = track?.contentType === 'BEAT' ? 'BEAT' : 'MUSIC';
  if (contentType === 'MUSIC') return { contentType };
  return {
    contentType,
    beatKey: track.beatKey || null,
    beatBpm: Number.isInteger(track.beatBpm) ? track.beatBpm : null,
    beatMood: track.beatMood || null,
    beatStyle: track.beatStyle || null,
    beatLicenseType: track.beatLicenseType || null,
    beatUsageNotes: track.beatUsageNotes || null,
    beatContactEnabled: track.beatContactEnabled === true
  };
}

module.exports = {
  BEAT_BPM_INVALID,
  BEAT_METADATA_INVALID,
  BEAT_METADATA_FIELDS,
  EMPTY_BEAT_METADATA,
  MIN_BEAT_BPM,
  MAX_BEAT_BPM,
  normalizeBeatKey,
  publicBeatMetadata,
  validateBeatMetadata
};
