'use strict';

const TRACK_CONTENT_TYPE_INVALID = 'TRACK_CONTENT_TYPE_INVALID';
const TRACK_CONTENT_TYPES = Object.freeze(['MUSIC', 'BEAT']);
const TRACK_CONTENT_TYPE_SET = new Set(TRACK_CONTENT_TYPES);

function parseTrackContentType(value, { defaultValue = 'MUSIC' } = {}) {
  if (value === undefined || value === null) {
    return { ok: true, value: defaultValue };
  }
  if (typeof value !== 'string') {
    return {
      ok: false,
      error: TRACK_CONTENT_TYPE_INVALID,
      message: 'contentType must be MUSIC or BEAT.'
    };
  }

  const normalized = value.trim().toUpperCase();
  if (!TRACK_CONTENT_TYPE_SET.has(normalized)) {
    return {
      ok: false,
      error: TRACK_CONTENT_TYPE_INVALID,
      message: 'contentType must be MUSIC or BEAT.'
    };
  }
  return { ok: true, value: normalized };
}

module.exports = {
  TRACK_CONTENT_TYPE_INVALID,
  TRACK_CONTENT_TYPES,
  parseTrackContentType
};
