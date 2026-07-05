import { API_BASE_URL } from '../client';

export function mapTrackResponse(backendTrack) {
  if (!backendTrack) return null;
  // Preserve already normalized responses.
  if (backendTrack.artistName && !backendTrack.artist) {
    return {
      ...backendTrack,
      title: backendTrack.title?.trim() || 'Untitled track',
      artistName: backendTrack.artistName?.trim() || 'Unknown artist',
      coverUrl: backendTrack.coverUrl || null,
      genre: backendTrack.genre?.trim() || 'No genre',
      duration: Number(backendTrack.duration) > 0 ? Number(backendTrack.duration) : null,
      plays: Number(backendTrack.plays || 0),
      likes: Number(backendTrack.likes || 0),
      isStreamable: backendTrack.isStreamable ?? Boolean(backendTrack.audioUrl),
      hasLyrics: Boolean(backendTrack.hasLyrics),
      lyricsType: backendTrack.hasLyrics ? (backendTrack.lyricsType || 'PLAIN') : 'NONE',
    };
  }
  
  let waveform = [];
  if (Array.isArray(backendTrack.waveform)) {
    waveform = backendTrack.waveform;
  } else if (backendTrack.waveformJson) {
    try {
      const parsed = JSON.parse(backendTrack.waveformJson);
      waveform = Array.isArray(parsed) ? parsed : [];
    } catch {
      waveform = [];
    }
  }

  const duration = Number(backendTrack.durationSeconds || backendTrack.duration || 0);
  const isStreamable = backendTrack.isStreamable
    ?? (backendTrack.status === 'PUBLISHED' && Boolean(backendTrack.processedAudioKey));
  const user = backendTrack.artist?.user;
  const artistName =
    user?.displayName?.trim()
    || user?.username?.trim()
    || (user?.email ? user.email.split('@')[0] : '')
    || backendTrack.artistName?.trim()
    || 'Unknown artist';

  return {
    id: backendTrack.id,
    title: backendTrack.title?.trim() || 'Untitled track',
    artistId: backendTrack.artistId,
    artistName,
    coverUrl: backendTrack.hasCoverImage || backendTrack.coverImageKey
      ? `${API_BASE_URL}/tracks/${backendTrack.id}/cover`
      : backendTrack.coverUrl || null,
    genre: backendTrack.genre?.trim() || 'No genre',
    plays: Number(backendTrack.plays || 0),
    likes: Number(backendTrack.likes || 0),
    duration: duration > 0 ? duration : null,
    durationSeconds: duration > 0 ? duration : null,
    audioUrl: isStreamable ? `${API_BASE_URL}/tracks/${backendTrack.id}/stream` : null,
    isStreamable,
    hasLyrics: Boolean(backendTrack.hasLyrics),
    lyricsType: backendTrack.hasLyrics ? (backendTrack.lyricsType || 'PLAIN') : 'NONE',
    tags: backendTrack.tags || [],
    description: backendTrack.description || '',
    releaseDate: backendTrack.releaseDate
      ? new Date(backendTrack.releaseDate).toISOString().slice(0, 10)
      : null,
    createdAt: backendTrack.createdAt || null,
    publishedAt: backendTrack.publishedAt || null,
    status: backendTrack.status,
    waveform
  };
}
