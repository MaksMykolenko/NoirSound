export const TRACK_CONTENT_TYPES = Object.freeze({
  MUSIC: 'MUSIC',
  BEAT: 'BEAT',
});

export function normalizeTrackContentType(value) {
  return String(value || '').trim().toUpperCase() === TRACK_CONTENT_TYPES.BEAT
    ? TRACK_CONTENT_TYPES.BEAT
    : TRACK_CONTENT_TYPES.MUSIC;
}

export function isBeatTrack(track) {
  return normalizeTrackContentType(track?.contentType) === TRACK_CONTENT_TYPES.BEAT;
}

export function getBeatMetadata(track) {
  if (!isBeatTrack(track)) return [];

  return [
    track?.beatBpm ? { key: 'bpm', label: 'BPM', value: String(track.beatBpm) } : null,
    track?.beatKey ? { key: 'key', label: 'Key', value: track.beatKey } : null,
    track?.beatMood ? { key: 'mood', label: 'Mood', value: track.beatMood } : null,
    track?.beatStyle ? { key: 'style', label: 'Style', value: track.beatStyle } : null,
  ].filter(Boolean);
}
