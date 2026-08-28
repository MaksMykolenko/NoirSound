'use strict';

const { hasLyrics: trackHasLyrics } = require('./lyrics');
const { publicBeatMetadata } = require('./beatMetadata');

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
    contentType: _contentType,
    beatKey: _beatKey,
    beatBpm: _beatBpm,
    beatMood: _beatMood,
    beatStyle: _beatStyle,
    beatLicenseType: _beatLicenseType,
    beatUsageNotes: _beatUsageNotes,
    beatContactEnabled: _beatContactEnabled,
    audioAsset: _audioAsset,
    uploads: _uploads,
    ...safeTrack
  } = track;

  const hasLyrics = trackHasLyrics(track);
  return {
    ...safeTrack,
    ...publicBeatMetadata(track),
    hasCoverImage: Boolean(coverImageKey),
    isStreamable: track.status === 'PUBLISHED' && Boolean(processedAudioKey),
    hasLyrics,
    lyricsType: hasLyrics ? lyricsType : 'NONE'
  };
}

module.exports = { serializePublicTrack };
