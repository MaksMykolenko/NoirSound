'use strict';

const { v4: uuidv4 } = require('uuid');
const { signatureMatchesDeclared } = require('./fileSignature');

const MAX_BANNER_BYTES = 8 * 1024 * 1024;
const MAX_BIO_LENGTH = 500;
const BANNER_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);
const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
});
const EXTENSION_MIME_TYPES = Object.freeze({
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
});
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;
const ACTIVE_BANNER_ROOT = 'profile-banner-active/';
const PENDING_BANNER_ROOT = 'profile-banner-pending/';
const LEGACY_BANNER_ROOT = 'users/';
const PROFILE_BANNER_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const ACTIVE_BANNER_KEY_PATTERN = /^profile-banner-active\/([^/]+)\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

class ProfileMediaError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'ProfileMediaError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function bannerPrefix(userId) {
  return `${ACTIVE_BANNER_ROOT}${String(userId)}/`;
}

function legacyBannerPrefix(userId) {
  return `${LEGACY_BANNER_ROOT}${String(userId)}/profile/banner/`;
}

function pendingBannerPrefix(userId) {
  return `${PENDING_BANNER_ROOT}${String(userId)}/`;
}

function createBannerUploadId(mimeType) {
  const extension = MIME_EXTENSIONS[String(mimeType || '').toLowerCase()];
  if (!extension) return null;
  return `${uuidv4()}.${extension}`;
}

function bannerKeyFromUploadId(userId, uploadId) {
  if (typeof uploadId !== 'string' || !UPLOAD_ID_PATTERN.test(uploadId)) return null;
  return `${bannerPrefix(userId)}${uploadId.toLowerCase()}`;
}

function legacyBannerKeyFromUploadId(userId, uploadId) {
  if (typeof uploadId !== 'string' || !UPLOAD_ID_PATTERN.test(uploadId)) return null;
  return `${legacyBannerPrefix(userId)}${uploadId.toLowerCase()}`;
}

function pendingBannerKeyFromUploadId(userId, uploadId) {
  if (typeof uploadId !== 'string' || !UPLOAD_ID_PATTERN.test(uploadId)) return null;
  return `${pendingBannerPrefix(userId)}${uploadId.toLowerCase()}`;
}

function isOwnedBannerKey(key, userId) {
  if (typeof key !== 'string') return false;
  return [bannerPrefix(userId), legacyBannerPrefix(userId)].some(
    (prefix) => key.startsWith(prefix) && UPLOAD_ID_PATTERN.test(key.slice(prefix.length))
  );
}

function isOwnedPendingBannerKey(key, userId) {
  if (typeof key !== 'string') return false;
  const prefix = pendingBannerPrefix(userId);
  return key.startsWith(prefix) && UPLOAD_ID_PATTERN.test(key.slice(prefix.length));
}

function mimeTypeForBannerKey(key) {
  if (typeof key !== 'string') return null;
  const extension = key.toLowerCase().split('.').pop();
  return EXTENSION_MIME_TYPES[extension] || null;
}

function validateBannerInit(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Banner metadata is required.' };
  }
  if (typeof body.fileName !== 'string' || !body.fileName.trim() || body.fileName.length > 255) {
    return { ok: false, message: 'Banner filename is required and must be at most 255 characters.' };
  }
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase() : '';
  if (!BANNER_MIME_TYPES.has(mimeType)) {
    return { ok: false, message: 'Banner must be a JPEG, PNG, or WebP image.' };
  }
  if (!Number.isInteger(body.fileSize) || body.fileSize <= 0 || body.fileSize > MAX_BANNER_BYTES) {
    return { ok: false, message: 'Banner must be no larger than 8 MB.' };
  }
  return { ok: true, mimeType, fileSize: body.fileSize };
}

function normalizeBio(value) {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string') {
    return { ok: false, message: 'Biography must be text.' };
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_BIO_LENGTH) {
    return { ok: false, message: `Biography must be at most ${MAX_BIO_LENGTH} characters.` };
  }
  return { ok: true, value: trimmed || null };
}

function isSafeLegacyMediaUrl(value) {
  if (typeof value !== 'string') return false;
  // A single-root path is same-origin. Reject protocol-relative and backslash
  // variants such as //evil.example or /\evil.example.
  if (/^\/(?![\\/])/.test(value)) return true;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

async function resolveBannerUrl(storage, user) {
  const value = user?.bannerUrl;
  if (!value) return null;
  if (isOwnedBannerKey(value, user.id)) {
    const prefix = value.startsWith(bannerPrefix(user.id))
      ? bannerPrefix(user.id)
      : legacyBannerPrefix(user.id);
    const uploadId = value.slice(prefix.length);
    return `/api/public/profile-banners/${encodeURIComponent(user.id)}/${encodeURIComponent(uploadId)}`;
  }
  // Preserve existing external/root-relative banners, but never return a raw
  // storage key that is malformed or belongs to a different account.
  return isSafeLegacyMediaUrl(value) ? value : null;
}

async function serializeUserMedia(storage, user) {
  if (!user) return user;
  return {
    ...user,
    bannerUrl: await resolveBannerUrl(storage, user)
  };
}

async function validateStoredBanner(storage, key) {
  let metadata;
  try {
    metadata = await storage.getObjectMetadata(key);
  } catch {
    throw new ProfileMediaError(
      'PROFILE_BANNER_STORAGE_UNAVAILABLE',
      'Could not verify the uploaded banner.',
      502
    );
  }

  const expectedMimeType = mimeTypeForBannerKey(key);
  const actualMimeType = String(metadata?.mimeType || '').toLowerCase();
  if (
    !metadata?.exists
    || !Number.isFinite(Number(metadata.size))
    || Number(metadata.size) <= 0
    || Number(metadata.size) > MAX_BANNER_BYTES
    || !BANNER_MIME_TYPES.has(actualMimeType)
    || actualMimeType !== expectedMimeType
  ) {
    throw new ProfileMediaError(
      'PROFILE_BANNER_INVALID',
      'Uploaded banner metadata is invalid.'
    );
  }

  let header;
  try {
    header = await storage.getObjectPrefix(key, 16);
  } catch {
    throw new ProfileMediaError(
      'PROFILE_BANNER_STORAGE_UNAVAILABLE',
      'Could not inspect the uploaded banner.',
      502
    );
  }
  if (!signatureMatchesDeclared(actualMimeType, header)) {
    throw new ProfileMediaError(
      'PROFILE_BANNER_INVALID',
      'Uploaded banner bytes do not match the declared image type.'
    );
  }

  return { size: Number(metadata.size), mimeType: actualMimeType };
}

async function safeDeleteOwnedBanner(storage, key, userId, logger = console) {
  if (!isOwnedBannerKey(key, userId) || typeof storage.deleteObject !== 'function') return false;
  try {
    await storage.deleteObject(key);
    return true;
  } catch (error) {
    logger?.warn?.({ err: error, userId }, 'Profile banner object cleanup failed');
    return false;
  }
}

async function safeDeleteOwnedPendingBanner(storage, key, userId, logger = console) {
  if (!isOwnedPendingBannerKey(key, userId) || typeof storage.deleteObject !== 'function') return false;
  try {
    await storage.deleteObject(key);
    return true;
  } catch (error) {
    logger?.warn?.({ err: error, userId }, 'Pending profile banner cleanup failed');
    return false;
  }
}

async function withProfileBannerLock(prisma, userId, callback) {
  if (typeof prisma?.$transaction !== 'function') return callback(prisma);
  return prisma.$transaction(async (transaction) => {
    if (typeof transaction.$queryRaw === 'function') {
      await transaction.$queryRaw`
        SELECT 1::int AS locked
        FROM (
          SELECT pg_advisory_xact_lock(hashtextextended(${String(userId)}, 0))
        ) AS acquired
      `;
    }
    return callback(transaction);
  });
}

async function completeBannerReplacementLocked({ prisma, storage, userId, pendingKey, newKey, logger }) {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) {
    throw new ProfileMediaError('PROFILE_NOT_FOUND', 'Profile not found.', 404);
  }
  if (!isOwnedBannerKey(newKey, userId)) {
    throw new ProfileMediaError('PROFILE_BANNER_INVALID', 'Banner upload id is invalid.');
  }
  if (!isOwnedPendingBannerKey(pendingKey, userId)) {
    throw new ProfileMediaError('PROFILE_BANNER_INVALID', 'Pending banner upload id is invalid.');
  }
  // Make completion idempotent. Most importantly, never treat the active key as
  // a disposable candidate and delete it during a repeated completion request.
  if (current.bannerUrl === newKey) {
    return { user: current, previousKey: null, cleanupPending: true };
  }

  try {
    await validateStoredBanner(storage, pendingKey);
  } catch (error) {
    if (error instanceof ProfileMediaError && error.code === 'PROFILE_BANNER_INVALID') {
      await safeDeleteOwnedPendingBanner(storage, pendingKey, userId, logger);
    }
    throw error;
  }

  try {
    await storage.copyObject(pendingKey, newKey);
  } catch {
    // CopyObject may have succeeded server-side before its response was lost,
    // and a duplicate completion may already have activated this same key.
    // Never delete either shared candidate on an ambiguous error; the pending
    // lifecycle and active-orphan sweeper handle any genuine leftovers.
    try {
      const latest = await prisma.user.findUnique({ where: { id: userId } });
      if (latest?.bannerUrl === newKey) {
        return { user: latest, previousKey: null, cleanupPending: true };
      }
    } catch {
      // Preserve both candidates when database state cannot be proven.
    }
    throw new ProfileMediaError(
      'PROFILE_BANNER_STORAGE_UNAVAILABLE',
      'Could not promote the uploaded banner.',
      502
    );
  }

  let updated;
  try {
    updated = await prisma.user.updateMany({
      where: { id: userId, bannerUrl: current.bannerUrl },
      data: { bannerUrl: newKey }
    });
  } catch (error) {
    try {
      const latest = await prisma.user.findUnique({ where: { id: userId } });
      if (latest?.bannerUrl === newKey) {
        return { user: latest, previousKey: null, cleanupPending: true };
      }
    } catch {
      // An ambiguous active candidate is retained for the grace-period sweep.
    }
    throw error;
  }

  if (updated.count !== 1) {
    // A concurrent completion for this exact upload may have won after our
    // initial read. Re-check before treating the candidate as disposable: the
    // active object must never be deleted by the losing request.
    const latest = await prisma.user.findUnique({ where: { id: userId } });
    if (latest?.bannerUrl === newKey) {
      return { user: latest, previousKey: null, cleanupPending: true };
    }
    throw new ProfileMediaError(
      'PROFILE_BANNER_CONFLICT',
      'The profile banner changed during upload. Please try again.',
      409
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return { user, previousKey: current.bannerUrl, cleanupPending: true };
}

async function completeBannerReplacement({ prisma, storage, userId, pendingKey, newKey, logger }) {
  const result = await withProfileBannerLock(prisma, userId, (lockedPrisma) => (
    completeBannerReplacementLocked({
      prisma: lockedPrisma,
      storage,
      userId,
      pendingKey,
      newKey,
      logger
    })
  ));

  // Cleanup happens only after the database transaction commits. Re-acquire
  // the same per-user lock and re-check the current key: a stale completion
  // may otherwise reactivate previousKey between commit and object deletion.
  if (isOwnedBannerKey(result.previousKey, userId)) {
    try {
      await withProfileBannerLock(prisma, userId, async (lockedPrisma) => {
        const latest = await lockedPrisma.user.findUnique({
          where: { id: userId },
          select: { bannerUrl: true }
        });
        if (latest?.bannerUrl === result.previousKey) return false;
        return safeDeleteOwnedBanner(storage, result.previousKey, userId, logger);
      });
    } catch (error) {
      logger?.warn?.({ err: error, userId }, 'Replaced profile banner cleanup deferred');
    }
  }
  if (result.cleanupPending) {
    await safeDeleteOwnedPendingBanner(storage, pendingKey, userId, logger);
  }
  return result.user;
}

async function cleanupOrphanedProfileBanners({
  prisma,
  storage,
  now = Date.now(),
  graceMs = PROFILE_BANNER_ORPHAN_GRACE_MS,
  logger = console
}) {
  if (
    typeof storage?.listObjectsByPrefix !== 'function'
    || typeof storage?.deleteObject !== 'function'
    || typeof prisma?.user?.findFirst !== 'function'
  ) {
    return { scanned: 0, eligible: 0, deleted: 0 };
  }

  const objects = await storage.listObjectsByPrefix(ACTIVE_BANNER_ROOT);
  const cutoff = Number(now) - Math.max(0, Number(graceMs) || 0);
  const eligible = objects.flatMap((object) => {
    const modifiedAt = new Date(object.lastModified || 0).getTime();
    const match = ACTIVE_BANNER_KEY_PATTERN.exec(object.key);
    if (!match || !Number.isFinite(modifiedAt) || modifiedAt > cutoff) return [];
    return [{ ...object, userId: match[1] }];
  });
  if (eligible.length === 0) {
    return { scanned: objects.length, eligible: 0, deleted: 0 };
  }

  let deleted = 0;
  for (const object of eligible) {
    try {
      const removed = await withProfileBannerLock(prisma, object.userId, async (lockedPrisma) => {
        const referenced = await lockedPrisma.user.findFirst({
          where: { id: object.userId, bannerUrl: object.key },
          select: { id: true }
        });
        if (referenced) return false;
        await storage.deleteObject(object.key);
        return true;
      });
      if (removed) deleted += 1;
    } catch (error) {
      logger?.warn?.({ err: error, key: object.key }, 'Orphaned profile banner cleanup failed');
    }
  }
  return { scanned: objects.length, eligible: eligible.length, deleted };
}

async function removeProfileBanner({ prisma, storage, userId, logger }) {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) {
    throw new ProfileMediaError('PROFILE_NOT_FOUND', 'Profile not found.', 404);
  }
  if (!current.bannerUrl) return current;

  const updated = await prisma.user.updateMany({
    where: { id: userId, bannerUrl: current.bannerUrl },
    data: { bannerUrl: null }
  });
  if (updated.count !== 1) {
    throw new ProfileMediaError(
      'PROFILE_BANNER_CONFLICT',
      'The profile banner changed before it could be removed. Please try again.',
      409
    );
  }

  await safeDeleteOwnedBanner(storage, current.bannerUrl, userId, logger);
  return prisma.user.findUnique({ where: { id: userId } });
}

module.exports = {
  BANNER_MIME_TYPES,
  ACTIVE_BANNER_ROOT,
  MAX_BANNER_BYTES,
  MAX_BIO_LENGTH,
  ProfileMediaError,
  PROFILE_BANNER_ORPHAN_GRACE_MS,
  bannerKeyFromUploadId,
  bannerPrefix,
  cleanupOrphanedProfileBanners,
  completeBannerReplacement,
  createBannerUploadId,
  isOwnedBannerKey,
  isOwnedPendingBannerKey,
  legacyBannerKeyFromUploadId,
  mimeTypeForBannerKey,
  normalizeBio,
  pendingBannerKeyFromUploadId,
  pendingBannerPrefix,
  removeProfileBanner,
  resolveBannerUrl,
  safeDeleteOwnedBanner,
  safeDeleteOwnedPendingBanner,
  serializeUserMedia,
  validateBannerInit,
  validateStoredBanner
};
