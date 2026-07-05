'use strict';

const { v4: uuidv4 } = require('uuid');
const { normalizeGenre } = require('../constants/musicGenres');
const { evaluateUploadAccess, ensureArtistProfile } = require('../lib/artistAccess');
const { auditData, createAudit } = require('../lib/auditLog');
const { validateLyricsPayload } = require('../lib/lyrics');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const {
  AUDIO_MIME_TYPES,
  COVER_MIME_TYPES,
  MAX_AUDIO_BYTES,
  MAX_COVER_BYTES,
  cleanFileName,
  metadataMismatch,
  validateFileMetadata
} = require('./uploads');
const {
  buildBatchValidation,
  cleanString,
  cleanStringList,
  inferTrackTitle,
  itemMissingFields,
  loadBatch,
  serializeBatch,
  syncBatchStatus
} = require('../lib/batchUpload');

const MAX_BATCH_FILES = Number(process.env.MAX_BATCH_FILES || 20);
const MAX_BATCH_BYTES = Number(process.env.MAX_BATCH_BYTES || 500 * 1024 * 1024);
const BATCH_MODES = new Set(['MIXED', 'SINGLES_ONLY', 'PLAYLIST']);
const ITEM_TARGETS = new Set(['SINGLE', 'PLAYLIST', 'EXCLUDED']);
const VISIBILITIES = new Set(['PUBLIC', 'PRIVATE']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg']);

function extensionOf(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function validateBatchFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return 'Select at least one audio file.';
  }
  if (files.length > MAX_BATCH_FILES) {
    return `A batch can contain at most ${MAX_BATCH_FILES} files.`;
  }
  const clientIds = new Set();
  let totalBytes = 0;
  for (const file of files) {
    if (!file || typeof file.clientId !== 'string' || !file.clientId.trim() || file.clientId.length > 100) {
      return 'Every file requires a valid clientId.';
    }
    const clientId = file.clientId.trim();
    if (clientIds.has(clientId)) return 'Duplicate clientId in batch.';
    clientIds.add(clientId);
    const error = validateFileMetadata({
      filename: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.fileSize
    }, {
      label: 'Audio',
      allowedMimeTypes: AUDIO_MIME_TYPES,
      maxBytes: MAX_AUDIO_BYTES
    });
    if (error) return error;
    if (!AUDIO_EXTENSIONS.has(extensionOf(file.fileName))) {
      return `Unsupported audio extension for ${cleanFileName(file.fileName)}.`;
    }
    totalBytes += file.fileSize;
  }
  if (totalBytes > MAX_BATCH_BYTES) {
    return `Batch exceeds the ${Math.floor(MAX_BATCH_BYTES / 1024 / 1024)}MB total limit.`;
  }
  return null;
}

async function requireUploadArtist(fastify, request, reply) {
  if (!['ARTIST', 'ADMIN'].includes(request.user.role)) {
    reply.status(403).send({ error: 'Only artists or admins can upload tracks.' });
    return null;
  }
  let profile = await fastify.prisma.artistProfile.findUnique({
    where: { userId: request.user.id },
    include: { user: { select: { displayName: true, username: true } } }
  });
  if (!profile && request.user.role === 'ADMIN') {
    const ensured = await ensureArtistProfile(fastify.prisma, request.user.id);
    profile = await fastify.prisma.artistProfile.findUnique({
      where: { id: ensured.profile.id },
      include: { user: { select: { displayName: true, username: true } } }
    });
    if (ensured.created) {
      await createAudit(fastify.prisma, auditData(
        request.user.id,
        'ARTIST_PROFILE_CREATED',
        'ARTIST',
        profile.id,
        'Automatic artist profile creation for admin batch upload.',
        { userId: request.user.id, triggeredBy: 'BATCH_UPLOAD_INIT' }
      ));
    }
  }
  const access = evaluateUploadAccess({
    role: request.user.role,
    status: request.user.status,
    artistProfile: profile
  });
  if (!access.canUploadTracks) {
    reply.status(422).send({
      error: 'ARTIST_PROFILE_REQUIRED',
      message: 'An active ArtistProfile is required before uploading tracks.',
      uploadAccessReason: access.uploadAccessReason
    });
    return null;
  }
  return profile;
}

function ownsBatch(batch, user) {
  return batch && (batch.userId === user.id || user.role === 'ADMIN');
}

async function getOwnedBatch(fastify, request, reply) {
  const batch = await loadBatch(fastify.prisma, request.params.batchId);
  if (!batch) {
    reply.status(404).send({ error: 'Batch not found.' });
    return null;
  }
  if (!ownsBatch(batch, request.user)) {
    reply.status(403).send({ error: 'You do not own this batch.' });
    return null;
  }
  return batch;
}

function mapVisibility(value) {
  return value === 'PRIVATE' ? false : true;
}

function trackDataFromItem(item, batch) {
  return {
    artistId: batch.artistProfileId,
    title: item.title.trim(),
    primaryArtistName: item.primaryArtistName.trim(),
    featuredArtists: item.featuredArtists,
    genre: normalizeGenre(item.genre),
    tags: item.tags,
    description: item.description?.trim() || null,
    explicit: item.explicit,
    isPublic: item.isPublic,
    copyrightConfirmed: item.copyrightConfirmed,
    lyricsText: item.lyricsText,
    lyricsType: item.lyricsType,
    lyricsLanguage: item.lyricsLanguage,
    lyricsSynced: item.lyricsSynced,
    lyricsRightsConfirmed: item.lyricsRightsConfirmed,
    lyricsUpdatedAt: item.lyricsText || item.lyricsType === 'SYNCED' ? item.updatedAt : null,
    originalAudioKey: item.upload.storageKey,
    coverImageKey: item.upload.coverStorageKey,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    status: 'DRAFT'
  };
}

async function verifyUploadObjects(fastify, upload) {
  const audioMeta = await fastify.storage.getObjectMetadata(upload.storageKey);
  const audioMismatch = metadataMismatch(audioMeta, upload.mimeType, upload.sizeBytes);
  if (audioMismatch) return `Audio ${audioMismatch}.`;
  if (upload.coverStorageKey) {
    const coverMeta = await fastify.storage.getObjectMetadata(upload.coverStorageKey);
    const coverMismatch = metadataMismatch(coverMeta, upload.coverMimeType, upload.coverSizeBytes);
    if (coverMismatch) return `Cover ${coverMismatch}.`;
  }
  return null;
}

async function uploadBatchesRoutes(fastify) {
  fastify.post('/init', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(5),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const profile = await requireUploadArtist(fastify, request, reply);
    if (!profile) return;

    const filesError = validateBatchFiles(request.body?.files);
    if (filesError) return reply.status(400).send({ error: filesError });
    const mode = request.body?.mode || 'MIXED';
    if (!BATCH_MODES.has(mode)) {
      return reply.status(400).send({ error: 'Invalid batch mode.' });
    }
    const clientBatchId = request.body?.clientBatchId == null
      ? null
      : cleanString(request.body.clientBatchId, 200);
    if (request.body?.clientBatchId != null && !clientBatchId) {
      return reply.status(400).send({ error: 'Invalid clientBatchId.' });
    }

    if (clientBatchId) {
      const existing = await fastify.prisma.uploadBatch.findUnique({
        where: {
          userId_clientId: {
            userId: request.user.id,
            clientId: clientBatchId
          }
        },
        include: { items: { include: { upload: true } } }
      });
      if (existing) {
        if (['PUBLISHED', 'CANCELLED'].includes(existing.status)) {
          return reply.status(409).send({ error: 'This idempotency key belongs to a closed batch.' });
        }
        const byClientId = new Map(existing.items.map((item) => [item.clientId, item]));
        const matches = request.body.files.every((file) => {
          const item = byClientId.get(file.clientId.trim());
          return item
            && item.fileName === cleanFileName(file.fileName)
            && item.fileSize === file.fileSize
            && item.mimeType === file.mimeType;
        });
        if (!matches || existing.items.length !== request.body.files.length) {
          return reply.status(409).send({ error: 'clientBatchId was already used with different files.' });
        }
        const replayableItems = existing.items.filter((item) =>
          !item.trackId
          && item.upload
          && ['INITIATED', 'UPLOADING', 'FAILED'].includes(item.upload.status)
        );
        const uploads = await Promise.all(replayableItems.map(async (item) => ({
          itemId: item.id,
          clientId: item.clientId,
          uploadId: item.uploadId,
          audioUploadUrl: await fastify.storage.createPresignedPutUrl(item.upload.storageKey, item.mimeType),
          method: 'PUT'
        })));
        if (uploads.length > 0) {
          await fastify.prisma.$transaction([
            fastify.prisma.upload.updateMany({
              where: { id: { in: uploads.map((entry) => entry.uploadId) } },
              data: { status: 'UPLOADING', errorMessage: null, processingError: null }
            }),
            fastify.prisma.uploadBatchItem.updateMany({
              where: { id: { in: uploads.map((entry) => entry.itemId) } },
              data: { status: 'DRAFT', errorCode: null, errorMessage: null }
            }),
            fastify.prisma.uploadBatch.update({
              where: { id: existing.id },
              data: { status: 'DRAFT' }
            })
          ]);
        }
        return {
          batchId: existing.id,
          status: existing.status,
          idempotentReplay: true,
          limits: {
            maxFiles: MAX_BATCH_FILES,
            maxFileBytes: MAX_AUDIO_BYTES,
            maxBatchBytes: MAX_BATCH_BYTES
          },
          duplicateFileNames: [],
          uploads
        };
      }
    }

    const batchId = uuidv4();
    const defaultArtistName = profile.user.displayName || profile.user.username;
    const records = request.body.files.map((file, index) => {
      const itemId = uuidv4();
      const uploadId = uuidv4();
      return {
        itemId,
        uploadId,
        clientId: file.clientId.trim(),
        fileName: cleanFileName(file.fileName),
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        storageKey: `uploads/${request.user.id}/batches/${batchId}/${itemId}/original_${cleanFileName(file.fileName)}`,
        target: mode === 'PLAYLIST' ? 'PLAYLIST' : 'SINGLE',
        playlistOrder: mode === 'PLAYLIST' ? index + 1 : null
      };
    });

    await fastify.prisma.$transaction(async (tx) => {
      await tx.uploadBatch.create({
        data: {
          id: batchId,
          clientId: clientBatchId,
          userId: request.user.id,
          artistProfileId: profile.id,
          mode
        }
      });
      for (const record of records) {
        await tx.upload.create({
          data: {
            id: record.uploadId,
            userId: request.user.id,
            type: 'AUDIO',
            status: 'INITIATED',
            originalFileName: record.fileName,
            storageKey: record.storageKey,
            mimeType: record.mimeType,
            sizeBytes: record.fileSize
          }
        });
        await tx.uploadBatchItem.create({
          data: {
            id: record.itemId,
            batchId,
            clientId: record.clientId,
            fileName: record.fileName,
            fileSize: record.fileSize,
            mimeType: record.mimeType,
            uploadId: record.uploadId,
            target: record.target,
            playlistOrder: record.playlistOrder,
            title: inferTrackTitle(record.fileName),
            primaryArtistName: defaultArtistName
          }
        });
      }
    });

    try {
      const uploads = await Promise.all(records.map(async (record) => ({
        itemId: record.itemId,
        clientId: record.clientId,
        uploadId: record.uploadId,
        audioUploadUrl: await fastify.storage.createPresignedPutUrl(record.storageKey, record.mimeType),
        method: 'PUT'
      })));
      await fastify.prisma.upload.updateMany({
        where: { id: { in: records.map((record) => record.uploadId) } },
        data: { status: 'UPLOADING' }
      });
      return reply.status(201).send({
        batchId,
        status: 'DRAFT',
        limits: {
          maxFiles: MAX_BATCH_FILES,
          maxFileBytes: MAX_AUDIO_BYTES,
          maxBatchBytes: MAX_BATCH_BYTES
        },
        duplicateFileNames: records
          .filter((record, index, all) => all.findIndex((other) => other.fileName === record.fileName) !== index)
          .map((record) => record.fileName),
        uploads
      });
    } catch (error) {
      fastify.log.error({ err: error, batchId }, 'Could not prepare batch upload URLs');
      await fastify.prisma.$transaction([
        fastify.prisma.uploadBatch.update({ where: { id: batchId }, data: { status: 'FAILED' } }),
        fastify.prisma.upload.updateMany({
          where: { id: { in: records.map((record) => record.uploadId) } },
          data: { status: 'FAILED', errorMessage: 'Could not prepare object storage upload.' }
        }),
        fastify.prisma.uploadBatchItem.updateMany({
          where: { batchId },
          data: { status: 'FAILED', errorCode: 'PRESIGN_FAILED', errorMessage: 'Could not prepare object storage upload.' }
        })
      ]);
      return reply.status(502).send({ error: 'Could not prepare batch upload.' });
    }
  });

  fastify.get('/', {
    preValidation: [fastify.authenticate]
  }, async (request) => {
    const batches = await fastify.prisma.uploadBatch.findMany({
      where: {
        userId: request.user.id,
        status: { notIn: ['CANCELLED'] }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: { select: { status: true, target: true } }
      },
      take: 25
    });
    return {
      data: batches.map((batch) => ({
        id: batch.id,
        mode: batch.mode,
        status: batch.status,
        playlistTitle: batch.playlistTitle,
        itemCount: batch.items.length,
        readyCount: batch.items.filter((item) => item.status === 'READY').length,
        failedCount: batch.items.filter((item) => item.status === 'FAILED').length,
        updatedAt: batch.updatedAt,
        createdAt: batch.createdAt
      }))
    };
  });

  fastify.get('/:batchId', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const batch = await getOwnedBatch(fastify, request, reply);
    if (!batch) return;
    return { batch: serializeBatch(batch) };
  });

  fastify.post('/:batchId/upload-urls', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(20),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const batch = await getOwnedBatch(fastify, request, reply);
    if (!batch) return;
    if (['PUBLISHED', 'CANCELLED'].includes(batch.status)) {
      return reply.status(409).send({ error: 'This batch no longer accepts uploads.' });
    }
    const uploads = await Promise.all(batch.items
      .filter((item) =>
        item.target !== 'EXCLUDED'
        && item.status !== 'FAILED'
        && item.upload
        && !['READY', 'PROCESSING'].includes(item.upload.status)
      )
      .map(async (item) => ({
        itemId: item.id,
        clientId: item.clientId,
        uploadId: item.uploadId,
        audioUploadUrl: await fastify.storage.createPresignedPutUrl(item.upload.storageKey, item.mimeType),
        method: 'PUT'
      })));
    if (uploads.length > 0) {
      await fastify.prisma.upload.updateMany({
        where: { id: { in: uploads.map((entry) => entry.uploadId) } },
        data: { status: 'UPLOADING', errorMessage: null, processingError: null }
      });
      await fastify.prisma.uploadBatchItem.updateMany({
        where: {
          id: { in: uploads.map((entry) => entry.itemId) },
          status: { in: ['DRAFT', 'UPLOADING', 'UPLOADED', 'FAILED'] }
        },
        data: { status: 'UPLOADING', errorCode: null, errorMessage: null }
      });
    }
    return { uploads };
  });

  fastify.patch('/:batchId/items/:itemId', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(240),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const batch = await getOwnedBatch(fastify, request, reply);
    if (!batch) return;
    if (['PUBLISHED', 'CANCELLED'].includes(batch.status)) {
      return reply.status(409).send({ error: 'This batch can no longer be edited.' });
    }
    const item = batch.items.find((candidate) => candidate.id === request.params.itemId);
    if (!item) return reply.status(404).send({ error: 'Batch item not found.' });
    if (item.status === 'PUBLISHED') {
      return reply.status(409).send({ error: 'Published tracks must be edited through the track editor.' });
    }

    const body = request.body || {};
    const data = {};
    if ('title' in body) {
      const title = cleanString(body.title, 150);
      if (!title) return reply.status(400).send({ error: 'Title is required and must be at most 150 characters.' });
      data.title = title;
    }
    if ('primaryArtistName' in body) {
      const value = cleanString(body.primaryArtistName, 150);
      if (!value) return reply.status(400).send({ error: 'Primary artist is required.' });
      data.primaryArtistName = value;
    }
    if ('featuredArtists' in body) {
      const values = cleanStringList(body.featuredArtists, { maxItems: 10, maxLength: 100 });
      if (!values) return reply.status(400).send({ error: 'Featured artists must be an array.' });
      data.featuredArtists = values;
    }
    if ('genre' in body) {
      if (body.genre === '' || body.genre === null) data.genre = null;
      else {
        const genre = normalizeGenre(body.genre);
        if (!genre) return reply.status(400).send({ error: 'Unsupported genre.' });
        data.genre = genre;
      }
    }
    if ('tags' in body) {
      const tags = cleanStringList(body.tags, { maxItems: 20, maxLength: 30 });
      if (!tags) return reply.status(400).send({ error: 'Tags must be an array.' });
      data.tags = tags;
    }
    if ('description' in body) {
      if (typeof body.description !== 'string' || body.description.length > 2000) {
        return reply.status(400).send({ error: 'Description must be at most 2000 characters.' });
      }
      data.description = cleanString(body.description, 2000) || null;
    }
    const lyricsFields = [
      'lyricsText',
      'lyricsType',
      'lyricsLanguage',
      'lyricsSynced',
      'lyricsRightsConfirmed'
    ];
    if (lyricsFields.some((field) => field in body)) {
      const lyricsResult = validateLyricsPayload({
        lyricsText: 'lyricsText' in body ? body.lyricsText : item.lyricsText,
        lyricsType: 'lyricsType' in body
          ? body.lyricsType
          : 'lyricsText' in body
            ? String(body.lyricsText || '').trim() ? 'PLAIN' : 'NONE'
            : item.lyricsType,
        lyricsLanguage: 'lyricsLanguage' in body ? body.lyricsLanguage : item.lyricsLanguage,
        lyricsSynced: 'lyricsSynced' in body ? body.lyricsSynced : item.lyricsSynced,
        lyricsRightsConfirmed: 'lyricsRightsConfirmed' in body
          ? body.lyricsRightsConfirmed
          : item.lyricsRightsConfirmed
      });
      if (!lyricsResult.ok) {
        return reply.status(400).send({
          error: lyricsResult.error,
          message: lyricsResult.message
        });
      }
      Object.assign(data, lyricsResult.data);
      delete data.hasLyrics;
    }
    for (const field of ['explicit', 'copyrightConfirmed']) {
      if (field in body) {
        if (typeof body[field] !== 'boolean') return reply.status(400).send({ error: `${field} must be boolean.` });
        data[field] = body[field];
      }
    }
    if ('visibility' in body) {
      if (!VISIBILITIES.has(body.visibility)) return reply.status(400).send({ error: 'Invalid visibility.' });
      data.isPublic = mapVisibility(body.visibility);
    }
    if ('target' in body) {
      if (!ITEM_TARGETS.has(body.target)) return reply.status(400).send({ error: 'Invalid target.' });
      if (batch.mode === 'SINGLES_ONLY' && body.target === 'PLAYLIST') {
        return reply.status(400).send({ error: 'This batch is configured for singles only.' });
      }
      if (batch.mode === 'PLAYLIST' && body.target === 'SINGLE') {
        return reply.status(400).send({ error: 'This batch is configured for playlist tracks only.' });
      }
      data.target = body.target;
      if (body.target === 'EXCLUDED') data.status = 'EXCLUDED';
      else if (item.status === 'EXCLUDED') data.status = item.upload?.status === 'READY' ? 'READY' : 'DRAFT';
    }
    if ('playlistOrder' in body) {
      if (body.playlistOrder !== null && (!Number.isInteger(body.playlistOrder) || body.playlistOrder < 1)) {
        return reply.status(400).send({ error: 'Playlist order must be a positive integer.' });
      }
      data.playlistOrder = body.playlistOrder;
    }

    let coverUploadUrl = null;
    if ('cover' in body && body.cover) {
      const coverError = validateFileMetadata({
        filename: body.cover.fileName,
        mimeType: body.cover.mimeType,
        sizeBytes: body.cover.fileSize
      }, {
        label: 'Cover',
        allowedMimeTypes: COVER_MIME_TYPES,
        maxBytes: MAX_COVER_BYTES
      });
      if (coverError) return reply.status(400).send({ error: coverError });
      const coverStorageKey = `uploads/${batch.userId}/batches/${batch.id}/${item.id}/cover_${cleanFileName(body.cover.fileName)}`;
      await fastify.prisma.upload.update({
        where: { id: item.uploadId },
        data: {
          coverStorageKey,
          coverMimeType: body.cover.mimeType,
          coverSizeBytes: body.cover.fileSize
        }
      });
      if (item.trackId) {
        await fastify.prisma.track.update({
          where: { id: item.trackId },
          data: { coverImageKey: coverStorageKey }
        });
      }
      coverUploadUrl = await fastify.storage.createPresignedPutUrl(coverStorageKey, body.cover.mimeType);
    }

    await fastify.prisma.uploadBatchItem.update({
      where: { id: item.id },
      data: {
        ...data,
        errorCode: null,
        errorMessage: null
      }
    });
    if (item.trackId && Object.keys(data).length > 0) {
      const latest = { ...item, ...data };
      await fastify.prisma.track.update({
        where: { id: item.trackId },
        data: {
          title: latest.title,
          primaryArtistName: latest.primaryArtistName,
          featuredArtists: latest.featuredArtists,
          genre: latest.genre ? normalizeGenre(latest.genre) : null,
          tags: latest.tags,
          description: latest.description,
          explicit: latest.explicit,
          isPublic: latest.isPublic,
          copyrightConfirmed: latest.copyrightConfirmed,
          lyricsText: latest.lyricsText,
          lyricsType: latest.lyricsType,
          lyricsLanguage: latest.lyricsLanguage,
          lyricsSynced: latest.lyricsSynced,
          lyricsRightsConfirmed: latest.lyricsRightsConfirmed,
          ...(lyricsFields.some((field) => field in body)
            ? { lyricsUpdatedAt: latest.lyricsText || latest.lyricsType === 'SYNCED' ? new Date() : null }
            : {})
        }
      });
    }
    const updated = await loadBatch(fastify.prisma, batch.id);
    return {
      batch: serializeBatch(updated),
      coverUploadUrl,
      coverUploadMethod: coverUploadUrl ? 'PUT' : null
    };
  });

  fastify.patch('/:batchId/playlist', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(120),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const batch = await getOwnedBatch(fastify, request, reply);
    if (!batch) return;
    if (['PUBLISHED', 'CANCELLED'].includes(batch.status)) {
      return reply.status(409).send({ error: 'This batch can no longer be edited.' });
    }
    const body = request.body || {};
    const data = {};
    if ('title' in body) {
      const title = cleanString(body.title, 150);
      if (!title && batch.items.some((item) => item.target === 'PLAYLIST')) {
        return reply.status(400).send({ error: 'Playlist title is required when playlist tracks are selected.' });
      }
      data.playlistTitle = title || null;
    }
    if ('description' in body) {
      if (typeof body.description !== 'string' || body.description.length > 2000) {
        return reply.status(400).send({ error: 'Playlist description must be at most 2000 characters.' });
      }
      data.playlistDescription = cleanString(body.description, 2000) || null;
    }
    if ('visibility' in body) {
      if (!VISIBILITIES.has(body.visibility)) return reply.status(400).send({ error: 'Invalid visibility.' });
      data.playlistIsPublic = mapVisibility(body.visibility);
    }
    if ('tags' in body) {
      const tags = cleanStringList(body.tags, { maxItems: 20, maxLength: 30 });
      if (!tags) return reply.status(400).send({ error: 'Playlist tags must be an array.' });
      data.playlistTags = tags;
    }
    if ('orderedItemIds' in body) {
      if (!Array.isArray(body.orderedItemIds) || new Set(body.orderedItemIds).size !== body.orderedItemIds.length) {
        return reply.status(400).send({ error: 'Playlist order must contain unique item ids.' });
      }
      const itemById = new Map(batch.items.map((item) => [item.id, item]));
      for (const itemId of body.orderedItemIds) {
        const item = itemById.get(itemId);
        if (!item || item.target !== 'PLAYLIST' || ['EXCLUDED', 'FAILED'].includes(item.status)) {
          return reply.status(400).send({ error: 'Playlist order contains an unavailable item.' });
        }
      }
      await fastify.prisma.$transaction(body.orderedItemIds.map((itemId, index) =>
        fastify.prisma.uploadBatchItem.update({
          where: { id: itemId },
          data: { playlistOrder: index + 1 }
        })
      ));
    }

    let playlistCoverUploadUrl = null;
    if ('cover' in body && body.cover) {
      const coverError = validateFileMetadata({
        filename: body.cover.fileName,
        mimeType: body.cover.mimeType,
        sizeBytes: body.cover.fileSize
      }, {
        label: 'Cover',
        allowedMimeTypes: COVER_MIME_TYPES,
        maxBytes: MAX_COVER_BYTES
      });
      if (coverError) return reply.status(400).send({ error: coverError });
      const key = `uploads/${batch.userId}/batches/${batch.id}/playlist/cover_${cleanFileName(body.cover.fileName)}`;
      data.playlistCoverStorageKey = key;
      data.playlistCoverMimeType = body.cover.mimeType;
      data.playlistCoverSizeBytes = body.cover.fileSize;
      playlistCoverUploadUrl = await fastify.storage.createPresignedPutUrl(key, body.cover.mimeType);
    }

    if (Object.keys(data).length > 0) {
      await fastify.prisma.uploadBatch.update({ where: { id: batch.id }, data });
    }
    const updated = await loadBatch(fastify.prisma, batch.id);
    return {
      batch: serializeBatch(updated),
      playlistCoverUploadUrl,
      coverUploadMethod: playlistCoverUploadUrl ? 'PUT' : null
    };
  });

  fastify.post('/:batchId/complete', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(10),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const batch = await getOwnedBatch(fastify, request, reply);
    if (!batch) return;
    const profile = await requireUploadArtist(fastify, request, reply);
    if (!profile || profile.id !== batch.artistProfileId) {
      if (profile) return reply.status(403).send({ error: 'Batch artist does not match the active artist profile.' });
      return;
    }
    if (['PUBLISHED', 'CANCELLED'].includes(batch.status)) {
      return reply.status(409).send({ error: `Batch cannot be completed from status ${batch.status}.` });
    }

    const results = [];
    for (const item of batch.items) {
      if (item.target === 'EXCLUDED') {
        if (item.status !== 'EXCLUDED') {
          await fastify.prisma.uploadBatchItem.update({ where: { id: item.id }, data: { status: 'EXCLUDED' } });
        }
        results.push({ itemId: item.id, status: 'EXCLUDED' });
        continue;
      }
      if (['PROCESSING', 'READY', 'PUBLISHED'].includes(item.status)) {
        results.push({ itemId: item.id, status: item.status, uploadId: item.uploadId, trackId: item.trackId });
        continue;
      }
      if (item.status === 'FAILED') {
        results.push({
          itemId: item.id,
          status: 'FAILED',
          error: item.errorMessage || item.upload?.errorMessage || 'Retry this failed item separately.'
        });
        continue;
      }
      const missing = itemMissingFields(item);
      if (missing.length > 0) {
        results.push({ itemId: item.id, status: item.status, missingFields: missing });
        continue;
      }
      if (!item.upload) {
        results.push({ itemId: item.id, status: 'FAILED', error: 'Upload record is missing.' });
        continue;
      }

      let objectError;
      try {
        objectError = await verifyUploadObjects(fastify, item.upload);
      } catch (error) {
        fastify.log.error({ err: error, itemId: item.id }, 'Batch object verification failed');
        objectError = 'Could not verify uploaded objects.';
      }
      if (objectError) {
        await fastify.prisma.$transaction([
          fastify.prisma.uploadBatchItem.update({
            where: { id: item.id },
            data: { status: 'FAILED', errorCode: 'OBJECT_VERIFICATION_FAILED', errorMessage: objectError }
          }),
          fastify.prisma.upload.update({
            where: { id: item.upload.id },
            data: { status: 'FAILED', errorMessage: objectError }
          })
        ]);
        results.push({ itemId: item.id, status: 'FAILED', error: objectError });
        continue;
      }

      let track;
      try {
        track = await fastify.prisma.$transaction(async (tx) => {
          const claimed = await tx.uploadBatchItem.updateMany({
            where: {
              id: item.id,
              status: { in: ['DRAFT', 'UPLOADING', 'UPLOADED'] }
            },
            data: { status: 'PROCESSING', errorCode: null, errorMessage: null }
          });
          if (claimed.count !== 1) return null;
          const createdTrack = item.trackId
            ? await tx.track.update({ where: { id: item.trackId }, data: trackDataFromItem(item, batch) })
            : await tx.track.create({ data: trackDataFromItem(item, batch) });
          await tx.upload.update({
            where: { id: item.upload.id },
            data: {
              trackId: createdTrack.id,
              status: 'PROCESSING',
              processingError: null,
              errorMessage: null
            }
          });
          await tx.uploadBatchItem.update({
            where: { id: item.id },
            data: { trackId: createdTrack.id }
          });
          return createdTrack;
        });
        if (!track) {
          results.push({ itemId: item.id, status: 'PROCESSING', uploadId: item.uploadId, trackId: item.trackId });
          continue;
        }
        const job = await fastify.audioQueue.add(
          'processAudio',
          { uploadId: item.upload.id, storageKey: item.upload.storageKey },
          {
            jobId: `upload-${item.upload.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
            removeOnFail: false
          }
        );
        results.push({
          itemId: item.id,
          uploadId: item.upload.id,
          trackId: track.id,
          jobId: job.id,
          status: 'PROCESSING'
        });
      } catch (error) {
        fastify.log.error({ err: error, itemId: item.id }, 'Could not start batch item processing');
        await fastify.prisma.$transaction([
          fastify.prisma.uploadBatchItem.update({
            where: { id: item.id },
            data: { status: 'FAILED', errorCode: 'QUEUE_FAILED', errorMessage: 'Audio processing could not be queued.' }
          }),
          fastify.prisma.upload.update({
            where: { id: item.upload.id },
            data: { status: 'FAILED', errorMessage: 'Audio processing could not be queued.' }
          }),
          ...(track ? [fastify.prisma.track.update({ where: { id: track.id }, data: { status: 'FAILED' } })] : [])
        ]);
        results.push({ itemId: item.id, status: 'FAILED', error: 'Audio processing could not be queued.' });
      }
    }

    await syncBatchStatus(fastify.prisma, batch.id);
    const updated = await loadBatch(fastify.prisma, batch.id);
    return { batch: serializeBatch(updated), items: results };
  });

  fastify.post('/:batchId/items/:itemId/retry', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(20),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const batch = await getOwnedBatch(fastify, request, reply);
    if (!batch) return;
    const profile = await requireUploadArtist(fastify, request, reply);
    if (!profile) return;
    const item = batch.items.find((candidate) => candidate.id === request.params.itemId);
    if (!item) return reply.status(404).send({ error: 'Batch item not found.' });
    if (item.status !== 'FAILED' || !item.upload || !item.track) {
      return reply.status(409).send({ error: 'Only a failed, initialized item can be retried.' });
    }

    const claimed = await fastify.prisma.$transaction(async (tx) => {
      const updated = await tx.uploadBatchItem.updateMany({
        where: { id: item.id, status: 'FAILED' },
        data: { status: 'PROCESSING', errorCode: null, errorMessage: null }
      });
      if (updated.count !== 1) return false;
      await tx.track.update({ where: { id: item.track.id }, data: { status: 'PROCESSING' } });
      await tx.upload.update({
        where: { id: item.upload.id },
        data: { status: 'PROCESSING', processingError: null, errorMessage: null }
      });
      await tx.uploadBatch.update({ where: { id: batch.id }, data: { status: 'PROCESSING' } });
      return true;
    });
    if (!claimed) return reply.status(409).send({ error: 'Retry has already started.' });

    try {
      const job = await fastify.audioQueue.add(
        'processAudio',
        { uploadId: item.upload.id, storageKey: item.upload.storageKey },
        {
          jobId: `upload-${item.upload.id}-retry-${Date.now()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
          removeOnFail: false
        }
      );
      if (request.user.role === 'ADMIN') {
        await createAudit(fastify.prisma, auditData(
          request.user.id,
          'BATCH_UPLOAD_ITEM_RETRY',
          'UPLOAD',
          item.upload.id,
          'Admin retried a failed batch upload item.',
          { batchId: batch.id, itemId: item.id, trackId: item.track.id }
        ));
      }
      return { itemId: item.id, status: 'PROCESSING', jobId: job.id };
    } catch {
      await fastify.prisma.$transaction([
        fastify.prisma.uploadBatchItem.update({
          where: { id: item.id },
          data: { status: 'FAILED', errorCode: 'QUEUE_FAILED', errorMessage: 'Audio processing could not be queued.' }
        }),
        fastify.prisma.track.update({ where: { id: item.track.id }, data: { status: 'FAILED' } }),
        fastify.prisma.upload.update({
          where: { id: item.upload.id },
          data: { status: 'FAILED', errorMessage: 'Audio processing could not be queued.' }
        })
      ]);
      return reply.status(503).send({ error: 'Audio processing could not be queued.' });
    }
  });

  fastify.post('/:batchId/publish', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(20),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const batch = await getOwnedBatch(fastify, request, reply);
    if (!batch) return;
    const profile = await requireUploadArtist(fastify, request, reply);
    if (!profile || profile.id !== batch.artistProfileId) {
      if (profile) return reply.status(403).send({ error: 'Batch artist does not match the active artist profile.' });
      return;
    }
    if (batch.status === 'CANCELLED') return reply.status(409).send({ error: 'Cancelled batches cannot be published.' });
    const allowPartial = request.body?.allowPartial === true;
    const validation = buildBatchValidation(batch);
    if (validation.missingFields.length > 0) {
      return reply.status(400).send({
        error: 'Batch metadata is incomplete.',
        missingFields: validation.missingFields
      });
    }

    const active = batch.items.filter((item) => item.target !== 'EXCLUDED');
    const publishable = active.filter((item) =>
      item.status === 'READY'
      && item.upload?.status === 'READY'
      && item.track?.processedAudioKey
    );
    const pending = active.filter((item) => !['READY', 'PUBLISHED'].includes(item.status));
    if (pending.length > 0 && !allowPartial) {
      return reply.status(409).send({
        error: 'All included tracks must be ready before publishing.',
        pendingItems: pending.map((item) => ({ itemId: item.id, status: item.status }))
      });
    }
    if (publishable.length === 0) {
      if (active.length > 0 && active.every((item) => item.status === 'PUBLISHED')) {
        const unchanged = await loadBatch(fastify.prisma, batch.id);
        return { batch: serializeBatch(unchanged), tracks: [], playlistId: batch.playlistId };
      }
      return reply.status(409).send({ error: 'No processed tracks are ready to publish.' });
    }

    const playlistTargets = active.filter((item) => item.target === 'PLAYLIST');
    const publishablePlaylist = publishable.filter((item) => item.target === 'PLAYLIST');
    const publishedPlaylist = playlistTargets.filter((item) => item.status === 'PUBLISHED');
    if (playlistTargets.length > 0 && !batch.playlistTitle?.trim()) {
      return reply.status(400).send({ error: 'Playlist title is required.' });
    }
    if (playlistTargets.length > 0 && publishablePlaylist.length + publishedPlaylist.length === 0) {
      return reply.status(409).send({ error: 'A playlist cannot be published without a ready track.' });
    }
    if (batch.playlistCoverStorageKey) {
      try {
        const meta = await fastify.storage.getObjectMetadata(batch.playlistCoverStorageKey);
        const mismatch = metadataMismatch(meta, batch.playlistCoverMimeType, batch.playlistCoverSizeBytes);
        if (mismatch) return reply.status(400).send({ error: `Playlist cover ${mismatch}.` });
      } catch {
        return reply.status(502).send({ error: 'Could not verify playlist cover.' });
      }
    }

    let result;
    try {
      result = await fastify.prisma.$transaction(async (tx) => {
        const claim = await tx.uploadBatch.updateMany({
          where: {
            id: batch.id,
            status: { in: ['READY', 'PARTIAL_READY'] }
          },
          data: { status: 'PROCESSING' }
        });
        if (claim.count !== 1) throw new Error('BATCH_PUBLISH_ALREADY_CLAIMED');

        let playlistId = batch.playlistId;
        if (playlistTargets.length > 0) {
          if (playlistId) {
            await tx.playlist.update({
              where: { id: playlistId },
              data: {
                name: batch.playlistTitle.trim(),
                description: batch.playlistDescription,
                isPublic: batch.playlistIsPublic,
                tags: batch.playlistTags,
                coverImageKey: batch.playlistCoverStorageKey
              }
            });
          } else {
            const playlist = await tx.playlist.create({
              data: {
                name: batch.playlistTitle.trim(),
                description: batch.playlistDescription,
                creatorId: batch.userId,
                artistProfileId: batch.artistProfileId,
                isPublic: batch.playlistIsPublic,
                tags: batch.playlistTags,
                coverImageKey: batch.playlistCoverStorageKey
              }
            });
            playlistId = playlist.id;
            await tx.uploadBatch.update({ where: { id: batch.id }, data: { playlistId } });
          }
        }

        const trackIds = [];
        for (const item of publishable) {
          await tx.track.update({
            where: { id: item.trackId },
            data: {
              title: item.title,
              primaryArtistName: item.primaryArtistName,
              featuredArtists: item.featuredArtists,
              genre: normalizeGenre(item.genre),
              tags: item.tags,
              description: item.description,
              explicit: item.explicit,
              isPublic: item.isPublic,
              copyrightConfirmed: item.copyrightConfirmed,
              lyricsText: item.lyricsText,
              lyricsType: item.lyricsType,
              lyricsLanguage: item.lyricsLanguage,
              lyricsSynced: item.lyricsSynced,
              lyricsRightsConfirmed: item.lyricsRightsConfirmed,
              lyricsUpdatedAt: item.lyricsText || item.lyricsType === 'SYNCED'
                ? item.updatedAt
                : null,
              status: 'PUBLISHED',
              publishedAt: new Date()
            }
          });
          await tx.uploadBatchItem.update({ where: { id: item.id }, data: { status: 'PUBLISHED' } });
          trackIds.push(item.trackId);
        }

        if (playlistId) {
          const ordered = playlistTargets
            .filter((item) => item.status === 'PUBLISHED' || publishable.some((ready) => ready.id === item.id))
            .sort((a, b) => (a.playlistOrder || 0) - (b.playlistOrder || 0));
          for (let index = 0; index < ordered.length; index += 1) {
            await tx.playlistTrack.upsert({
              where: {
                playlistId_trackId: {
                  playlistId,
                  trackId: ordered[index].trackId
                }
              },
              create: {
                playlistId,
                trackId: ordered[index].trackId,
                order: index + 1
              },
              update: { order: index + 1 }
            });
          }
        }

        const remaining = active.filter((item) =>
          item.status !== 'PUBLISHED' && !publishable.some((ready) => ready.id === item.id)
        );
        const status = remaining.length > 0 ? 'PARTIAL_READY' : 'PUBLISHED';
        await tx.uploadBatch.update({ where: { id: batch.id }, data: { status } });
        return { trackIds, playlistId, status };
      });
    } catch (error) {
      if (error.message !== 'BATCH_PUBLISH_ALREADY_CLAIMED') throw error;
      const current = await loadBatch(fastify.prisma, batch.id);
      if (current?.status === 'PUBLISHED') {
        return {
          batch: serializeBatch(current),
          tracks: [],
          playlistId: current.playlistId,
          partial: false
        };
      }
      return reply.status(409).send({ error: 'Batch publishing is already in progress.' });
    }

    const updated = await loadBatch(fastify.prisma, batch.id);
    return {
      batch: serializeBatch(updated),
      tracks: result.trackIds.map((id) => ({ id })),
      playlistId: result.playlistId,
      partial: result.status === 'PARTIAL_READY'
    };
  });

  fastify.delete('/:batchId', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(20),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const batch = await getOwnedBatch(fastify, request, reply);
    if (!batch) return;
    if (batch.items.some((item) => item.status === 'PUBLISHED')) {
      return reply.status(409).send({ error: 'A batch with published tracks cannot be cancelled.' });
    }

    const trackIds = batch.items.map((item) => item.trackId).filter(Boolean);
    const objectKeys = [
      batch.playlistCoverStorageKey,
      ...batch.items.flatMap((item) => [
        item.upload?.storageKey,
        item.upload?.coverStorageKey,
        item.track?.processedAudioKey
      ])
    ].filter(Boolean);

    await fastify.prisma.$transaction(async (tx) => {
      await tx.upload.updateMany({
        where: { id: { in: batch.items.map((item) => item.uploadId).filter(Boolean) } },
        data: { status: 'CANCELLED', trackId: null }
      });
      await tx.uploadBatchItem.updateMany({
        where: { batchId: batch.id },
        data: { status: 'EXCLUDED', trackId: null }
      });
      if (trackIds.length > 0) await tx.track.deleteMany({ where: { id: { in: trackIds } } });
      await tx.uploadBatch.update({ where: { id: batch.id }, data: { status: 'CANCELLED' } });
    });
    if (typeof fastify.storage.deleteObject === 'function') {
      await Promise.allSettled(objectKeys.map((key) => fastify.storage.deleteObject(key)));
    }
    return reply.status(204).send();
  });
}

module.exports = uploadBatchesRoutes;
module.exports.MAX_BATCH_FILES = MAX_BATCH_FILES;
module.exports.MAX_BATCH_BYTES = MAX_BATCH_BYTES;
module.exports.validateBatchFiles = validateBatchFiles;
