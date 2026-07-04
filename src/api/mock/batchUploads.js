const batches = new Map();

const inferTitle = (name) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

function validation(batch) {
  const missingFields = [];
  const active = batch.items.filter((item) => item.target !== 'EXCLUDED');
  active.forEach((item) => {
    if (!item.title) missingFields.push({ scope: 'item', itemId: item.id, field: 'title' });
    if (!item.genre) missingFields.push({ scope: 'item', itemId: item.id, field: 'genre' });
    if (!item.copyrightConfirmed) missingFields.push({ scope: 'item', itemId: item.id, field: 'copyrightConfirmed' });
  });
  if (active.some((item) => item.target === 'PLAYLIST') && !batch.playlist.title) {
    missingFields.push({ scope: 'playlist', field: 'title' });
  }
  return {
    canPublish: missingFields.length === 0 && active.length > 0 && active.every((item) => item.status === 'READY'),
    canPublishPartial: missingFields.length === 0 && active.some((item) => item.status === 'READY'),
    missingFields,
  };
}

function snapshot(batch) {
  return { ...structuredClone(batch), ...validation(batch) };
}

export async function createBatchUpload(files, mode = 'MIXED') {
  const batchId = `demo-batch-${Date.now()}`;
  const batch = {
    id: batchId,
    mode,
    status: 'DRAFT',
    creator: { displayName: 'Demo Artist', username: 'demo_artist' },
    playlist: { id: null, title: '', description: '', visibility: 'PUBLIC', tags: [], hasCover: false },
    items: files.map(({ clientId, file }, index) => ({
      id: `demo-item-${Date.now()}-${index}`,
      clientId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      uploadStatus: 'UPLOADING',
      processingStatus: null,
      durationSeconds: 0,
      status: 'DRAFT',
      target: mode === 'PLAYLIST' ? 'PLAYLIST' : 'SINGLE',
      playlistOrder: mode === 'PLAYLIST' ? index + 1 : null,
      title: inferTitle(file.name),
      primaryArtistName: 'Demo Artist',
      featuredArtists: [],
      genre: null,
      tags: [],
      description: '',
      explicit: false,
      visibility: 'PUBLIC',
      copyrightConfirmed: false,
      hasCover: false,
      errorCode: null,
      errorMessage: null,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  batches.set(batchId, batch);
  return {
    batchId,
    status: 'DRAFT',
    limits: { maxFiles: 20, maxFileBytes: 50 * 1024 * 1024, maxBatchBytes: 500 * 1024 * 1024 },
    duplicateFileNames: [],
    uploads: batch.items.map((item) => ({ itemId: item.id, clientId: item.clientId, uploadId: `upload-${item.id}`, audioUploadUrl: 'mock://upload' })),
  };
}

export async function listMyBatchUploads() {
  return {
    data: [...batches.values()].map((batch) => ({
      id: batch.id,
      mode: batch.mode,
      status: batch.status,
      playlistTitle: batch.playlist.title,
      itemCount: batch.items.length,
      readyCount: batch.items.filter((item) => item.status === 'READY').length,
      failedCount: batch.items.filter((item) => item.status === 'FAILED').length,
      updatedAt: batch.updatedAt,
    })),
  };
}

export async function getBatchUpload(batchId) {
  const batch = batches.get(batchId);
  if (!batch) throw new Error('Batch not found.');
  return { batch: snapshot(batch) };
}

export async function updateBatchItem(batchId, itemId, updates) {
  const batch = batches.get(batchId);
  const item = batch.items.find((entry) => entry.id === itemId);
  Object.assign(item, updates);
  if (updates.target === 'EXCLUDED') item.status = 'EXCLUDED';
  else if (item.status === 'EXCLUDED') item.status = 'DRAFT';
  batch.updatedAt = new Date().toISOString();
  return { batch: snapshot(batch), coverUploadUrl: updates.cover ? 'mock://cover' : null };
}

export async function updateBatchPlaylist(batchId, updates) {
  const batch = batches.get(batchId);
  if (updates.orderedItemIds) {
    updates.orderedItemIds.forEach((id, index) => {
      const item = batch.items.find((entry) => entry.id === id);
      if (item) item.playlistOrder = index + 1;
    });
  }
  Object.assign(batch.playlist, {
    ...(updates.title !== undefined ? { title: updates.title } : {}),
    ...(updates.description !== undefined ? { description: updates.description } : {}),
    ...(updates.visibility !== undefined ? { visibility: updates.visibility } : {}),
    ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
    ...(updates.cover ? { hasCover: true } : {}),
  });
  return { batch: snapshot(batch), playlistCoverUploadUrl: updates.cover ? 'mock://cover' : null };
}

export async function getBatchUploadUrls(batchId) {
  const batch = batches.get(batchId);
  return { uploads: batch.items.filter((item) => item.target !== 'EXCLUDED').map((item) => ({ itemId: item.id, audioUploadUrl: 'mock://upload' })) };
}

export async function uploadBatchAudioFiles(batchId, _filesByItemId, onProgress) {
  const batch = batches.get(batchId);
  batch.items.filter((item) => item.target !== 'EXCLUDED').forEach((item) => onProgress?.(item.id, 100));
  return [];
}

export async function uploadBatchItemCover(batchId, itemId) {
  const batch = batches.get(batchId);
  batch.items.find((item) => item.id === itemId).hasCover = true;
  return { batch: snapshot(batch) };
}

export async function uploadBatchPlaylistCover(batchId) {
  const batch = batches.get(batchId);
  batch.playlist.hasCover = true;
  return { batch: snapshot(batch) };
}

export async function completeBatchUpload(batchId) {
  const batch = batches.get(batchId);
  batch.items.forEach((item) => {
    if (item.target !== 'EXCLUDED') {
      item.status = 'READY';
      item.uploadStatus = 'READY';
      item.processingStatus = 'DRAFT';
      item.trackId = `demo-track-${item.id}`;
    }
  });
  batch.status = 'READY';
  return { batch: snapshot(batch), items: batch.items };
}

export async function retryBatchItem(batchId, itemId) {
  const batch = batches.get(batchId);
  const item = batch.items.find((entry) => entry.id === itemId);
  item.status = 'READY';
  item.errorMessage = null;
  return { itemId, status: 'READY' };
}

export async function publishBatchUpload(batchId, allowPartial = false) {
  const batch = batches.get(batchId);
  batch.items.forEach((item) => {
    if (item.status === 'READY') item.status = 'PUBLISHED';
  });
  batch.status = batch.items.some((item) => item.status === 'FAILED') && allowPartial ? 'PARTIAL_READY' : 'PUBLISHED';
  if (batch.items.some((item) => item.target === 'PLAYLIST')) batch.playlist.id = `demo-playlist-${Date.now()}`;
  return { batch: snapshot(batch), tracks: [], playlistId: batch.playlist.id, partial: batch.status === 'PARTIAL_READY' };
}

export async function cancelBatchUpload(batchId) {
  batches.delete(batchId);
}
