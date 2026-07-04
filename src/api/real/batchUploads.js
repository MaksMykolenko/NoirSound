import { ApiError, apiFetch } from '../client';

function fileMetadata(file) {
  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
}

export function createBatchUpload(files, mode = 'MIXED') {
  const clientBatchId = files.length > 0
    ? `batch-${files[0].clientId}-${files.length}`
    : undefined;
  return apiFetch('/uploads/batch/init', {
    method: 'POST',
    body: JSON.stringify({
      mode,
      clientBatchId,
      files: files.map(({ clientId, file }) => ({
        clientId,
        ...fileMetadata(file),
      })),
    }),
  });
}

export function listMyBatchUploads() {
  return apiFetch('/uploads/batch');
}

export function getBatchUpload(batchId) {
  return apiFetch(`/uploads/batch/${batchId}`);
}

export function updateBatchItem(batchId, itemId, updates) {
  return apiFetch(`/uploads/batch/${batchId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function updateBatchPlaylist(batchId, updates) {
  return apiFetch(`/uploads/batch/${batchId}/playlist`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function getBatchUploadUrls(batchId) {
  return apiFetch(`/uploads/batch/${batchId}/upload-urls`, { method: 'POST' });
}

function putFile(url, file, onProgress) {
  if (typeof XMLHttpRequest === 'undefined') {
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    }).then((response) => {
      if (!response.ok) throw new ApiError(`Storage upload failed (${response.status}).`, response.status);
    });
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', file.type);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new ApiError(`Storage upload failed (${request.status}).`, request.status));
    });
    request.addEventListener('error', () => reject(new ApiError('Storage upload failed.', 0)));
    request.send(file);
  });
}

export async function uploadBatchAudioFiles(batchId, filesByItemId, onProgress) {
  const response = await getBatchUploadUrls(batchId);
  for (const upload of response.uploads || []) {
    const file = filesByItemId[upload.itemId];
    if (!file) throw new ApiError(`Reselect ${upload.itemId} before uploading.`, 400);
    await putFile(upload.audioUploadUrl, file, (percent) => onProgress?.(upload.itemId, percent));
  }
  return response.uploads || [];
}

export async function uploadBatchItemCover(batchId, itemId, coverFile) {
  const response = await updateBatchItem(batchId, itemId, {
    cover: fileMetadata(coverFile),
  });
  if (response.coverUploadUrl) await putFile(response.coverUploadUrl, coverFile);
  return response;
}

export async function uploadBatchPlaylistCover(batchId, coverFile) {
  const response = await updateBatchPlaylist(batchId, {
    cover: fileMetadata(coverFile),
  });
  if (response.playlistCoverUploadUrl) await putFile(response.playlistCoverUploadUrl, coverFile);
  return response;
}

export function completeBatchUpload(batchId) {
  return apiFetch(`/uploads/batch/${batchId}/complete`, { method: 'POST' });
}

export function retryBatchItem(batchId, itemId) {
  return apiFetch(`/uploads/batch/${batchId}/items/${itemId}/retry`, { method: 'POST' });
}

export function publishBatchUpload(batchId, allowPartial = false) {
  return apiFetch(`/uploads/batch/${batchId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ allowPartial }),
  });
}

export function cancelBatchUpload(batchId) {
  return apiFetch(`/uploads/batch/${batchId}`, { method: 'DELETE' });
}
