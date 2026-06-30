'use strict';

/**
 * Convert an internal Track record into the public API shape.
 *
 * Storage object keys and upload-only metadata must never leave the backend.
 * The frontend only needs booleans indicating whether the cover/stream routes
 * are available.
 */
function serializePublicTrack(track) {
  if (!track) return null;

  const {
    originalAudioKey: _originalAudioKey,
    processedAudioKey,
    coverImageKey,
    mimeType: _mimeType,
    fileSize: _fileSize,
    copyrightConfirmed: _copyrightConfirmed,
    audioAsset: _audioAsset,
    uploads: _uploads,
    ...safeTrack
  } = track;

  return {
    ...safeTrack,
    hasCoverImage: Boolean(coverImageKey),
    isStreamable: track.status === 'PUBLISHED' && Boolean(processedAudioKey)
  };
}

module.exports = { serializePublicTrack };
