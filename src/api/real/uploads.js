import { ApiError, apiFetch } from '../client';

export async function uploadTrack(trackData) {
  const contentType = trackData.contentType === 'BEAT' ? 'BEAT' : 'MUSIC';
  const beatBpm = trackData.beatBpm === '' || trackData.beatBpm == null
    ? null
    : Number(trackData.beatBpm);
  const beatText = (value) => typeof value === 'string' ? value.trim() || null : null;
  const hasSyncedLyrics = trackData.lyricsType === 'SYNCED'
    && Array.isArray(trackData.lyricsSynced)
    && trackData.lyricsSynced.length > 0;
  const hasPlainLyrics = Boolean(trackData.lyricsText?.trim());
  const hasLyrics = hasSyncedLyrics || hasPlainLyrics;
  const initResponse = await apiFetch('/uploads/track/init', {
    method: 'POST',
    body: JSON.stringify({
      title: trackData.title,
      description: trackData.description,
      genre: trackData.genre,
      tags: trackData.tags || [],
      contentType,
      beatBpm: contentType === 'BEAT' ? beatBpm : null,
      beatKey: contentType === 'BEAT' ? beatText(trackData.beatKey) : null,
      beatMood: contentType === 'BEAT' ? beatText(trackData.beatMood) : null,
      beatStyle: contentType === 'BEAT' ? beatText(trackData.beatStyle) : null,
      beatLicenseType: contentType === 'BEAT' ? beatText(trackData.beatLicenseType) : null,
      beatUsageNotes: contentType === 'BEAT' ? beatText(trackData.beatUsageNotes) : null,
      beatContactEnabled: contentType === 'BEAT' && trackData.beatContactEnabled === true,
      copyrightConfirmed: trackData.copyrightConfirmed === true,
      lyricsText: trackData.lyricsText || '',
      lyricsType: hasSyncedLyrics ? 'SYNCED' : hasPlainLyrics ? 'PLAIN' : 'NONE',
      lyricsLanguage: hasLyrics ? trackData.lyricsLanguage || null : null,
      lyricsSynced: hasSyncedLyrics ? trackData.lyricsSynced : null,
      lyricsRightsConfirmed: hasLyrics && trackData.lyricsRightsConfirmed === true,
      audio: {
        filename: trackData.audioFile.name,
        mimeType: trackData.audioFile.type,
        sizeBytes: trackData.audioFile.size,
      },
      cover: trackData.coverFile ? {
        filename: trackData.coverFile.name,
        mimeType: trackData.coverFile.type,
        sizeBytes: trackData.coverFile.size,
      } : null,
    }),
  });

  const { uploadId, trackId, audioUploadUrl, coverUploadUrl } = initResponse;
  const audioResponse = await fetch(audioUploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': trackData.audioFile.type },
    body: trackData.audioFile,
  });
  if (!audioResponse.ok) {
    throw new ApiError(`Audio storage upload failed (${audioResponse.status}).`, audioResponse.status);
  }

  if (coverUploadUrl && trackData.coverFile) {
    const coverResponse = await fetch(coverUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': trackData.coverFile.type },
      body: trackData.coverFile,
    });
    if (!coverResponse.ok) {
      throw new ApiError(`Cover storage upload failed (${coverResponse.status}).`, coverResponse.status);
    }
  }

  await apiFetch(`/uploads/track/${uploadId}/complete`, { method: 'POST' });
  return { trackId, uploadId };
}

export async function getUploadStatus(uploadId) {
  if (!uploadId) throw new ApiError('Upload ID is required.', 400);
  return apiFetch(`/uploads/track/${uploadId}/status`);
}
