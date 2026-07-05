'use strict';

const { normalizeGenre } = require('../constants/musicGenres');
const { hasLyrics } = require('./lyrics');

const REQUIRED_ITEM_FIELDS = Object.freeze([
  'title',
  'primaryArtistName',
  'genre',
  'copyrightConfirmed'
]);

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[<>]/g, '').slice(0, maxLength);
}

function cleanStringList(value, { maxItems = 20, maxLength = 50 } = {}) {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((entry) => cleanString(entry, maxLength))
    .filter(Boolean);
  return [...new Set(cleaned)].slice(0, maxItems);
}

function inferTrackTitle(fileName) {
  const base = String(fileName || '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base.slice(0, 150) || 'Untitled track';
}

function itemMissingFields(item) {
  if (!item || item.target === 'EXCLUDED') return [];
  const missing = [];
  if (!item.title?.trim()) missing.push('title');
  if (!item.primaryArtistName?.trim()) missing.push('primaryArtistName');
  if (!item.genre || !normalizeGenre(item.genre)) missing.push('genre');
  if (item.copyrightConfirmed !== true) missing.push('copyrightConfirmed');
  if ((item.lyricsText?.trim() || item.lyricsType === 'SYNCED')
      && item.lyricsRightsConfirmed !== true) {
    missing.push('lyricsRightsConfirmed');
  }
  return missing;
}

function buildBatchValidation(batch) {
  const items = batch.items || [];
  const active = items.filter((item) => item.target !== 'EXCLUDED');
  const playlistItems = active.filter((item) => item.target === 'PLAYLIST');
  const missingFields = [];

  for (const item of active) {
    for (const field of itemMissingFields(item)) {
      missingFields.push({ scope: 'item', itemId: item.id, field });
    }
  }
  if (playlistItems.length > 0 && !batch.playlistTitle?.trim()) {
    missingFields.push({ scope: 'playlist', field: 'title' });
  }

  const allReady = active.length > 0 && active.every((item) =>
    ['READY', 'PUBLISHED'].includes(item.status)
  );
  const ready = active.filter((item) => ['READY', 'PUBLISHED'].includes(item.status));
  const readyPlaylist = ready.filter((item) => item.target === 'PLAYLIST');
  const playlistCanPublish = playlistItems.length === 0
    || (Boolean(batch.playlistTitle?.trim()) && readyPlaylist.length > 0);

  return {
    canPublish: allReady && missingFields.length === 0 && playlistCanPublish,
    canPublishPartial: ready.length > 0 && missingFields.length === 0 && playlistCanPublish,
    missingFields
  };
}

function serializeBatch(batch) {
  const validation = buildBatchValidation(batch);
  const creator = batch.artistProfile?.user;
  return {
    id: batch.id,
    mode: batch.mode,
    status: batch.status,
    artistProfileId: batch.artistProfileId,
    creator: creator ? {
      displayName: creator.displayName,
      username: creator.username
    } : null,
    playlist: {
      id: batch.playlistId || null,
      title: batch.playlistTitle || '',
      description: batch.playlistDescription || '',
      visibility: batch.playlistIsPublic ? 'PUBLIC' : 'PRIVATE',
      tags: batch.playlistTags || [],
      hasCover: Boolean(batch.playlistCoverStorageKey)
    },
    items: (batch.items || []).map((item) => ({
      id: item.id,
      clientId: item.clientId,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      trackId: item.trackId || null,
      uploadId: item.uploadId || null,
      uploadStatus: item.upload?.status || null,
      processingStatus: item.track?.status || null,
      durationSeconds: item.track?.durationSeconds || 0,
      status: item.status,
      target: item.target,
      playlistOrder: item.playlistOrder,
      title: item.title,
      primaryArtistName: item.primaryArtistName,
      featuredArtists: item.featuredArtists || [],
      genre: item.genre,
      tags: item.tags || [],
      description: item.description || '',
      explicit: item.explicit,
      visibility: item.isPublic ? 'PUBLIC' : 'PRIVATE',
      copyrightConfirmed: item.copyrightConfirmed,
      hasLyrics: hasLyrics(item),
      lyricsText: item.lyricsText || '',
      lyricsType: item.lyricsType || 'NONE',
      lyricsLanguage: item.lyricsLanguage || null,
      lyricsSynced: item.lyricsType === 'SYNCED' ? item.lyricsSynced : null,
      lyricsRightsConfirmed: item.lyricsRightsConfirmed,
      hasCover: Boolean(item.upload?.coverStorageKey),
      errorCode: item.errorCode,
      errorMessage: item.errorMessage || item.upload?.errorMessage || null,
      missingFields: itemMissingFields(item),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    })),
    ...validation,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt
  };
}

async function loadBatch(prisma, batchId) {
  return prisma.uploadBatch.findUnique({
    where: { id: batchId },
    include: {
      artistProfile: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              role: true,
              status: true
            }
          }
        }
      },
      items: {
        include: {
          upload: true,
          track: {
            select: {
              id: true,
              status: true,
              durationSeconds: true,
              processedAudioKey: true,
              coverImageKey: true
            }
          }
        },
        orderBy: [
          { playlistOrder: 'asc' },
          { createdAt: 'asc' }
        ]
      }
    }
  });
}

async function syncBatchStatus(prisma, batchId) {
  if (!batchId) return null;
  const batch = await prisma.uploadBatch.findUnique({
    where: { id: batchId },
    select: {
      status: true,
      items: { select: { status: true, target: true } }
    }
  });
  if (!batch || ['PUBLISHED', 'CANCELLED'].includes(batch.status)) return batch?.status || null;

  const active = batch.items.filter((item) => item.target !== 'EXCLUDED');
  const statuses = active.map((item) => item.status);
  let status = 'DRAFT';
  if (statuses.length === 0) status = 'DRAFT';
  else if (statuses.every((value) => value === 'PUBLISHED')) status = 'PUBLISHED';
  else if (statuses.some((value) => value === 'PUBLISHED')) status = 'PARTIAL_READY';
  else if (statuses.every((value) => value === 'READY')) status = 'READY';
  else if (statuses.some((value) => value === 'READY')) status = 'PARTIAL_READY';
  else if (statuses.some((value) => value === 'PROCESSING')) status = 'PROCESSING';
  else if (statuses.every((value) => value === 'FAILED')) status = 'FAILED';
  else if (statuses.some((value) => ['UPLOADING', 'UPLOADED'].includes(value))) status = 'UPLOADING';

  if (status !== batch.status) {
    await prisma.uploadBatch.update({ where: { id: batchId }, data: { status } });
  }
  return status;
}

module.exports = {
  REQUIRED_ITEM_FIELDS,
  buildBatchValidation,
  cleanString,
  cleanStringList,
  inferTrackTitle,
  itemMissingFields,
  loadBatch,
  serializeBatch,
  syncBatchStatus
};
