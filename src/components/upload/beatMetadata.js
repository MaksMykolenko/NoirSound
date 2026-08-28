export const EMPTY_BEAT_METADATA = Object.freeze({
  beatBpm: '',
  beatKey: '',
  beatMood: '',
  beatStyle: '',
  beatLicenseType: '',
  beatUsageNotes: '',
  beatContactEnabled: false,
});

export function beatMetadataFromTrack(track = {}) {
  return {
    beatBpm: track.beatBpm == null ? '' : String(track.beatBpm),
    beatKey: track.beatKey || '',
    beatMood: track.beatMood || '',
    beatStyle: track.beatStyle || '',
    beatLicenseType: track.beatLicenseType || '',
    beatUsageNotes: track.beatUsageNotes || '',
    beatContactEnabled: Boolean(track.beatContactEnabled),
  };
}

export function beatMetadataPayload(contentType, metadata = EMPTY_BEAT_METADATA) {
  if (contentType !== 'BEAT') {
    return {
      beatBpm: null,
      beatKey: null,
      beatMood: null,
      beatStyle: null,
      beatLicenseType: null,
      beatUsageNotes: null,
      beatContactEnabled: false,
    };
  }

  const normalizedBpm = metadata.beatBpm === '' || metadata.beatBpm == null
    ? null
    : Number(metadata.beatBpm);

  return {
    beatBpm: Number.isFinite(normalizedBpm) ? normalizedBpm : null,
    beatKey: metadata.beatKey?.trim() || null,
    beatMood: metadata.beatMood?.trim() || null,
    beatStyle: metadata.beatStyle?.trim() || null,
    beatLicenseType: metadata.beatLicenseType?.trim() || null,
    beatUsageNotes: metadata.beatUsageNotes?.trim() || null,
    beatContactEnabled: metadata.beatContactEnabled === true,
  };
}
