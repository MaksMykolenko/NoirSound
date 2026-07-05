'use strict';

const { hasLyrics: trackHasLyrics } = require('./lyrics');

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
    lyricsText: _lyricsText,
    lyricsType,
    lyricsLanguage: _lyricsLanguage,
    lyricsSynced: _lyricsSynced,
    lyricsRightsConfirmed: _lyricsRightsConfirmed,
    lyricsUpdatedAt: _lyricsUpdatedAt,
    audioAsset: _audioAsset,
    uploads: _uploads,
    ...safeTrack
  } = track;

  const hasLyrics = trackHasLyrics(track);
  return {
    ...safeTrack,
    hasCoverImage: Boolean(coverImageKey),
    isStreamable: track.status === 'PUBLISHED' && Boolean(processedAudioKey),
    hasLyrics,
    lyricsType: hasLyrics ? lyricsType : 'NONE'
  };
}

module.exports = { serializePublicTrack };
