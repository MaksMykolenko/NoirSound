import { ApiError, apiFetch } from '../client';

export async function uploadTrack(trackData) {
  const initResponse = await apiFetch('/uploads/track/init', {
    method: 'POST',
    body: JSON.stringify({
      title: trackData.title,
      description: trackData.description,
      genre: trackData.genre,
      tags: trackData.tags || [],
      copyrightConfirmed: trackData.copyrightConfirmed === true,
      lyricsText: trackData.lyricsText || '',
      lyricsType: trackData.lyricsText?.trim() ? (trackData.lyricsType || 'PLAIN') : 'NONE',
      lyricsLanguage: trackData.lyricsLanguage || null,
      lyricsRightsConfirmed: trackData.lyricsRightsConfirmed === true,
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
