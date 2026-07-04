const { v4: uuidv4 } = require('uuid');
const { normalizeGenre } = require('../constants/musicGenres');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const { auditData, createAudit } = require('../lib/auditLog');
const { evaluateUploadAccess, ensureArtistProfile } = require('../lib/artistAccess');

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/aac',
  'audio/ogg'
]);
const COVER_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

function cleanFileName(filename) {
  return filename
    .split(/[\\/]/)
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180);
}

function validateFileMetadata(file, { label, allowedMimeTypes, maxBytes }) {
  if (!file || typeof file !== 'object') return `${label} metadata is required.`;
  if (typeof file.filename !== 'string' || !file.filename.trim()) {
    return `${label} filename is required.`;
  }
  if (typeof file.mimeType !== 'string' || !allowedMimeTypes.has(file.mimeType)) {
    return `Invalid ${label.toLowerCase()} MIME type.`;
  }
  if (!Number.isInteger(file.sizeBytes) || file.sizeBytes <= 0) {
    return `${label} size must be a positive integer.`;
  }
  if (file.sizeBytes > maxBytes) {
    return `${label} file exceeds ${Math.floor(maxBytes / 1024 / 1024)}MB limit.`;
  }
  return null;
}

function validateInitBody(body) {
  if (!body || typeof body !== 'object') return 'Request body is required.';

  const { title, description, genre, tags, copyrightConfirmed, audio, cover } = body;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) {
    return 'Title is required and must be at most 150 characters.';
  }
  if (typeof genre !== 'string' || !genre.trim() || genre.trim().length > 50) {
    return 'Genre is required and must be at most 50 characters.';
  }
  // Genre must map to a supported taxonomy key. Niche styles go in tags; if the
  // creator has no close match they can submit "other" and describe it via tags.
  if (!normalizeGenre(genre)) {
    return 'Unsupported genre. Pick a supported genre, or use "other" and add tags for the specific style.';
  }
  if (description !== undefined && description !== null &&
      (typeof description !== 'string' || description.length > 2000)) {
    return 'Description must be at most 2000 characters.';
  }
  if (!Array.isArray(tags) || tags.length > 20 ||
      tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 30)) {
    return 'Tags must be an array of at most 20 non-empty strings, each at most 30 characters.';
  }
  if (copyrightConfirmed !== true) {
    return 'Copyright confirmation is required.';
  }

  const audioError = validateFileMetadata(audio, {
    label: 'Audio',
    allowedMimeTypes: AUDIO_MIME_TYPES,
    maxBytes: MAX_AUDIO_BYTES
  });
  if (audioError) return audioError;

  if (cover) {
    const coverError = validateFileMetadata(cover, {
      label: 'Cover',
      allowedMimeTypes: COVER_MIME_TYPES,
      maxBytes: MAX_COVER_BYTES
    });
    if (coverError) return coverError;
  }

  return null;
}

function metadataMismatch(meta, expectedMimeType, expectedSize) {
  if (!meta.exists) return 'object is missing';
  if (meta.mimeType !== expectedMimeType) {
    return `content type mismatch (expected ${expectedMimeType}, received ${meta.mimeType || 'unknown'})`;
  }
  if (meta.size !== expectedSize) {
    return `content length mismatch (expected ${expectedSize}, received ${meta.size ?? 'unknown'})`;
  }
  return null;
}

async function uploadsRoutes(fastify) {
  fastify.post('/track/init', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(10),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    if (!['ARTIST', 'ADMIN'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Only artists or admins can upload tracks.' });
    }

    const validationError = validateInitBody(request.body);
    if (validationError) {
      return reply.status(400).send({ error: validationError });
    }

    // Single source of truth for "does this user have working artist upload
    // access" — see backend/src/lib/artistAccess.js. Admins keep the narrow,
    // pre-existing behavior of getting a bare profile created for them
    // automatically (their role already implies trust); every other role
    // must be granted access explicitly through the admin console
    // (POST /api/admin/users/:id/grant-artist) rather than via this route.
    let artistProfile = await fastify.prisma.artistProfile.findUnique({
      where: { userId: request.user.id },
      select: { id: true, isHidden: true }
    });
    if (!artistProfile && request.user.role === 'ADMIN') {
      const ensured = await ensureArtistProfile(fastify.prisma, request.user.id);
      artistProfile = ensured.profile;
      if (ensured.created) {
        await createAudit(fastify.prisma, auditData(
          request.user.id,
          'ARTIST_PROFILE_CREATED',
          'ARTIST',
          ensured.profile.id,
          'Automatic artist profile creation for admin upload.',
          { userId: request.user.id, triggeredBy: 'UPLOAD_INIT' }
        ));
      }
    }

    const access = evaluateUploadAccess({
      role: request.user.role,
      status: request.user.status,
      artistProfile
    });
    if (!access.canUploadTracks) {
      return reply.status(422).send({
        error: 'ARTIST_PROFILE_REQUIRED',
        message: 'An ArtistProfile is required before uploading tracks.',
        uploadAccessReason: access.uploadAccessReason
      });
    }

    const {
      title,
      description,
      genre,
      tags,
      copyrightConfirmed,
      audio,
      cover
    } = request.body;

    const trackId = uuidv4();
    const originalAudioKey =
      `uploads/${request.user.id}/${trackId}/original_${cleanFileName(audio.filename)}`;
    const coverImageKey = cover
      ? `uploads/${request.user.id}/${trackId}/cover_${cleanFileName(cover.filename)}`
      : null;

    let persisted;
    try {
      persisted = await fastify.prisma.$transaction(async (tx) => {
        const track = await tx.track.create({
          data: {
            id: trackId,
            artistId: artistProfile.id,
            title: title.trim(),
            description: description?.trim() || null,
            // Persist the stable, lowercase snake_case key (never display text).
            genre: normalizeGenre(genre),
            tags: [...new Set(tags.map((tag) => tag.trim()))],
            status: 'DRAFT',
            copyrightConfirmed,
            originalAudioKey,
            coverImageKey,
            mimeType: audio.mimeType,
            fileSize: audio.sizeBytes
          }
        });

        const upload = await tx.upload.create({
          data: {
            userId: request.user.id,
            trackId: track.id,
            type: 'AUDIO',
            status: 'INITIATED',
            originalFileName: cleanFileName(audio.filename),
            storageKey: originalAudioKey,
            mimeType: audio.mimeType,
            sizeBytes: audio.sizeBytes,
            coverStorageKey: coverImageKey,
            coverMimeType: cover?.mimeType || null,
            coverSizeBytes: cover?.sizeBytes || null
          }
        });

        return { track, upload };
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Upload initialization database transaction failed');
      return reply.status(500).send({ error: 'Could not initialize upload.' });
    }

    try {
      const [audioUploadUrl, coverUploadUrl] = await Promise.all([
        fastify.storage.createPresignedPutUrl(originalAudioKey, audio.mimeType),
        cover
          ? fastify.storage.createPresignedPutUrl(coverImageKey, cover.mimeType)
          : Promise.resolve(null)
      ]);

      await fastify.prisma.upload.update({
        where: { id: persisted.upload.id },
        data: { status: 'UPLOADING' }
      });

      return {
        trackId: persisted.track.id,
        uploadId: persisted.upload.id,
        audioUploadUrl,
        coverUploadUrl,
        method: 'PUT',
        status: 'UPLOADING'
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Could not create presigned upload URLs');
      await fastify.prisma.$transaction([
        fastify.prisma.track.update({
          where: { id: persisted.track.id },
          data: { status: 'FAILED' }
        }),
        fastify.prisma.upload.update({
          where: { id: persisted.upload.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Could not prepare object storage upload.'
          }
        })
      ]);
      return reply.status(502).send({ error: 'Could not prepare object storage upload.' });
    }
  });

  fastify.post('/track/:uploadId/complete', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(20),
        timeWindow: '1 hour',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const { uploadId } = request.params;
    const upload = await fastify.prisma.upload.findUnique({
      where: { id: uploadId },
      include: { track: true }
    });

    if (!upload) {
      return reply.status(404).send({ error: 'Upload not found.' });
    }
    if (upload.userId !== request.user.id && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'You do not own this upload.' });
    }
    if (!upload.track) {
      return reply.status(409).send({ error: 'Upload is not linked to a track.' });
    }
    if (!['INITIATED', 'UPLOADING'].includes(upload.status)) {
      return reply.status(409).send({
        error: `Upload cannot be completed from status ${upload.status}.`
      });
    }

    try {
      const audioMeta = await fastify.storage.getObjectMetadata(upload.storageKey);
      const audioMismatch = metadataMismatch(audioMeta, upload.mimeType, upload.sizeBytes);
      if (audioMismatch) {
        return reply.status(400).send({ error: `Audio ${audioMismatch}.` });
      }

      if (upload.coverStorageKey) {
        const coverMeta = await fastify.storage.getObjectMetadata(upload.coverStorageKey);
        const coverMismatch = metadataMismatch(
          coverMeta,
          upload.coverMimeType,
          upload.coverSizeBytes
        );
        if (coverMismatch) {
          return reply.status(400).send({ error: `Cover ${coverMismatch}.` });
        }
      }
    } catch (error) {
      fastify.log.error({ err: error, uploadId }, 'Object metadata verification failed');
      return reply.status(502).send({ error: 'Could not verify uploaded objects.' });
    }

    try {
      await fastify.prisma.$transaction(async (tx) => {
        const claimed = await tx.upload.updateMany({
          where: {
            id: upload.id,
            status: { in: ['INITIATED', 'UPLOADING'] }
          },
          data: {
            status: 'PROCESSING',
            errorMessage: null,
            processingError: null
          }
        });

        if (claimed.count !== 1) {
          throw new Error('UPLOAD_ALREADY_CLAIMED');
        }

        await tx.track.update({
          where: { id: upload.track.id },
          data: { status: 'PROCESSING' }
        });
      });
    } catch (error) {
      if (error.message === 'UPLOAD_ALREADY_CLAIMED') {
        return reply.status(409).send({ error: 'Upload has already been completed.' });
      }
      fastify.log.error({ err: error, uploadId }, 'Could not claim upload for processing');
      return reply.status(500).send({ error: 'Could not start upload processing.' });
    }

    try {
      const job = await fastify.audioQueue.add(
        'processAudio',
        {
          uploadId: upload.id,
          storageKey: upload.storageKey
        },
        {
          jobId: `upload-${upload.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
          removeOnFail: false
        }
      );

      return {
        success: true,
        uploadId: upload.id,
        trackId: upload.track.id,
        jobId: job.id,
        status: 'PROCESSING'
      };
    } catch (error) {
      fastify.log.error({ err: error, uploadId }, 'Could not enqueue audio processing job');
      await fastify.prisma.$transaction([
        fastify.prisma.track.update({
          where: { id: upload.track.id },
          data: { status: 'FAILED' }
        }),
        fastify.prisma.upload.update({
          where: { id: upload.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Audio processing could not be queued.'
          }
        })
      ]);
      return reply.status(503).send({ error: 'Audio processing could not be queued.' });
    }
  });

  fastify.get('/track/:uploadId/status', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const upload = await fastify.prisma.upload.findUnique({
      where: { id: request.params.uploadId },
      include: {
        track: {
          select: {
            id: true,
            status: true,
            processedAudioKey: true,
            durationSeconds: true
          }
        }
      }
    });

    if (!upload) {
      return reply.status(404).send({ error: 'Upload not found.' });
    }
    if (upload.userId !== request.user.id && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'You do not own this upload.' });
    }

    return {
      uploadId: upload.id,
      trackId: upload.track?.id || null,
      status: upload.status,
      trackStatus: upload.track?.status || null,
      processedAudioReady: Boolean(upload.track?.processedAudioKey),
      durationSeconds: upload.track?.durationSeconds || 0,
      error: upload.status === 'FAILED'
        ? upload.errorMessage || 'Audio processing failed.'
        : null,
      updatedAt: upload.updatedAt
    };
  });
}

module.exports = uploadsRoutes;
module.exports.MAX_AUDIO_BYTES = MAX_AUDIO_BYTES;
module.exports.MAX_COVER_BYTES = MAX_COVER_BYTES;
module.exports.AUDIO_MIME_TYPES = AUDIO_MIME_TYPES;
module.exports.COVER_MIME_TYPES = COVER_MIME_TYPES;
module.exports.cleanFileName = cleanFileName;
module.exports.validateFileMetadata = validateFileMetadata;
module.exports.validateInitBody = validateInitBody;
module.exports.metadataMismatch = metadataMismatch;
