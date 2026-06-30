'use strict';

/**
 * Magic-byte / file-signature detection. Pure + dependency-free so it can be
 * unit-tested without storage. Used by the worker to verify that the bytes that
 * were actually uploaded match an allowed audio type, regardless of the
 * client-declared MIME type at presign time.
 */

function startsWith(buf, bytes, offset = 0) {
  if (!buf || buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function ascii(str) {
  return Array.from(str).map((c) => c.charCodeAt(0));
}

/** Detect a canonical media type from the leading bytes, or null. */
function detectMediaType(buf) {
  if (!buf || buf.length < 4) return null;

  // Audio ---------------------------------------------------------------
  // MP3: ID3 tag or MPEG frame sync (0xFFEx/0xFFFx)
  if (startsWith(buf, ascii('ID3'))) return 'audio/mpeg';
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    // Could be MP3 or ADTS-AAC. ADTS AAC uses 0xFFF1/0xFFF9.
    if (buf[1] === 0xf1 || buf[1] === 0xf9) return 'audio/aac';
    return 'audio/mpeg';
  }
  // WAV: 'RIFF'....'WAVE'
  if (startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WAVE'), 8)) return 'audio/wav';
  // FLAC
  if (startsWith(buf, ascii('fLaC'))) return 'audio/flac';
  // OGG (Vorbis/Opus container)
  if (startsWith(buf, ascii('OggS'))) return 'audio/ogg';
  // MP4/M4A audio container: 'ftyp' at offset 4
  if (startsWith(buf, ascii('ftyp'), 4)) return 'audio/mp4';

  // Images --------------------------------------------------------------
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WEBP'), 8)) return 'image/webp';

  return null;
}

const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/aac', 'audio/mp4']);

/** True if the bytes look like a real, supported audio file. */
function isAllowedAudioSignature(buf) {
  return AUDIO_TYPES.has(detectMediaType(buf));
}

// Map declared MIME -> acceptable detected types (tolerant of codec/container aliases).
const DECLARED_ALIASES = {
  'audio/mpeg': ['audio/mpeg'],
  'audio/mp3': ['audio/mpeg'],
  'audio/wav': ['audio/wav'],
  'audio/x-wav': ['audio/wav'],
  'audio/flac': ['audio/flac'],
  'audio/x-flac': ['audio/flac'],
  'audio/ogg': ['audio/ogg'],
  'audio/aac': ['audio/aac', 'audio/mpeg'],
  'image/jpeg': ['image/jpeg'],
  'image/png': ['image/png'],
  'image/webp': ['image/webp']
};

/** True if the actual bytes are consistent with the declared MIME type. */
function signatureMatchesDeclared(declaredMime, buf) {
  const detected = detectMediaType(buf);
  if (!detected) return false;
  const allowed = DECLARED_ALIASES[String(declaredMime || '').toLowerCase()];
  if (!allowed) return false;
  return allowed.includes(detected);
}

module.exports = {
  detectMediaType,
  isAllowedAudioSignature,
  signatureMatchesDeclared,
  AUDIO_TYPES
};
