import { describe, expect, it, vi } from 'vitest';
import profileMedia from '../src/lib/profileMedia.js';

const {
  ACTIVE_BANNER_ROOT,
  MAX_BANNER_BYTES,
  MAX_BIO_LENGTH,
  bannerKeyFromUploadId,
  cleanupOrphanedProfileBanners,
  completeBannerReplacement,
  createBannerUploadId,
  isOwnedBannerKey,
  normalizeBio,
  pendingBannerKeyFromUploadId,
  removeProfileBanner,
  resolveBannerUrl,
  validateBannerInit,
  validateStoredBanner,
} = profileMedia;

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_HEADER = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

function bannerStorage(overrides = {}) {
  return {
    getObjectMetadata: vi.fn(async () => ({
      exists: true,
      size: 1024,
      mimeType: 'image/png',
    })),
    getObjectPrefix: vi.fn(async () => PNG_HEADER),
    getPublicOrSignedUrl: vi.fn(async (key) => `https://storage.test/${encodeURIComponent(key)}?signed=1`),
    copyObject: vi.fn(async () => {}),
    deleteObject: vi.fn(async () => {}),
    ...overrides,
  };
}

function statefulPrisma(user, { updateError = null, conflict = false, events = [] } = {}) {
  const state = { ...user };
  return {
    state,
    user: {
      findUnique: vi.fn(async () => ({ ...state })),
      updateMany: vi.fn(async ({ where, data }) => {
        events.push('db-update');
        if (updateError) throw updateError;
        if (conflict || state.id !== where.id || state.bannerUrl !== where.bannerUrl) {
          return { count: 0 };
        }
        Object.assign(state, data);
        return { count: 1 };
      }),
    },
  };
}

describe('profile media constraints', () => {
  it('uses an independent 8 MB JPEG/PNG/WebP banner contract', () => {
    expect(validateBannerInit({
      fileName: '../wide.png',
      mimeType: 'image/png',
      fileSize: MAX_BANNER_BYTES,
    })).toMatchObject({ ok: true, mimeType: 'image/png' });
    expect(validateBannerInit({
      fileName: 'wide.png',
      mimeType: 'image/png',
      fileSize: MAX_BANNER_BYTES + 1,
    }).ok).toBe(false);
    expect(validateBannerInit({
      fileName: 'vector.svg',
      mimeType: 'image/svg+xml',
      fileSize: 100,
    }).ok).toBe(false);
  });

  it('generates an opaque upload id with strictly owner-scoped pending and active keys', () => {
    const uploadId = createBannerUploadId('image/webp');
    const key = bannerKeyFromUploadId('user-1', uploadId);
    const pendingKey = pendingBannerKeyFromUploadId('user-1', uploadId);
    expect(uploadId).toMatch(/\.webp$/);
    expect(key).toBe(`profile-banner-active/user-1/${uploadId}`);
    expect(pendingKey).toBe(`profile-banner-pending/user-1/${uploadId}`);
    expect(isOwnedBannerKey(key, 'user-1')).toBe(true);
    expect(isOwnedBannerKey(key, 'user-2')).toBe(false);
    expect(bannerKeyFromUploadId('user-1', '../other/banner.png')).toBeNull();
    expect(pendingBannerKeyFromUploadId('user-1', '../other/banner.png')).toBeNull();
  });

  it('normalizes empty biographies to null and enforces 500 characters', () => {
    expect(MAX_BIO_LENGTH).toBe(500);
    expect(normalizeBio('  first line\nsecond line  ')).toEqual({
      ok: true,
      value: 'first line\nsecond line',
    });
    expect(normalizeBio('   ')).toEqual({ ok: true, value: null });
    expect(normalizeBio('x'.repeat(500)).ok).toBe(true);
    expect(normalizeBio('x'.repeat(501)).ok).toBe(false);
    expect(normalizeBio({ html: '<script>' }).ok).toBe(false);
  });

  it.each([
    ['image/jpeg', JPEG_HEADER],
    ['image/png', PNG_HEADER],
    ['image/webp', WEBP_HEADER],
  ])('accepts valid %s metadata and magic bytes', async (mimeType, header) => {
    const key = bannerKeyFromUploadId('user-1', createBannerUploadId(mimeType));
    const storage = bannerStorage({
      getObjectMetadata: vi.fn(async () => ({ exists: true, size: 1024, mimeType })),
      getObjectPrefix: vi.fn(async () => header),
    });
    await expect(validateStoredBanner(storage, key)).resolves.toEqual({
      size: 1024,
      mimeType,
    });
  });

  it('rejects missing objects and MIME/signature mismatches', async () => {
    const key = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const storage = bannerStorage();
    storage.getObjectPrefix.mockResolvedValue(Buffer.from('<script>alert(1)</script>'));
    await expect(validateStoredBanner(storage, key)).rejects.toMatchObject({
      code: 'PROFILE_BANNER_INVALID',
      statusCode: 400,
    });

    storage.getObjectMetadata.mockResolvedValue({
      exists: true,
      size: 1024,
      mimeType: 'image/png',
    });
    storage.getObjectPrefix.mockResolvedValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]),
    );
    await expect(validateStoredBanner(storage, key)).rejects.toMatchObject({
      code: 'PROFILE_BANNER_INVALID',
      statusCode: 400,
    });

    storage.getObjectMetadata.mockResolvedValue({ exists: false });
    await expect(validateStoredBanner(storage, key)).rejects.toMatchObject({
      code: 'PROFILE_BANNER_INVALID',
      statusCode: 400,
    });
  });
});

describe('profile banner replacement and cleanup', () => {
  it('updates the database before deleting the previous owned object', async () => {
    const events = [];
    const oldKey = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const uploadId = createBannerUploadId('image/png');
    const pendingKey = pendingBannerKeyFromUploadId('user-1', uploadId);
    const newKey = bannerKeyFromUploadId('user-1', uploadId);
    const prisma = statefulPrisma({ id: 'user-1', bannerUrl: oldKey }, { events });
    const storage = bannerStorage({
      copyObject: vi.fn(async (source, destination) => events.push(`copy:${source}:${destination}`)),
      deleteObject: vi.fn(async (key) => events.push(`delete:${key}`)),
    });

    const updated = await completeBannerReplacement({
      prisma,
      storage,
      userId: 'user-1',
      pendingKey,
      newKey,
      logger: { warn: vi.fn() },
    });

    expect(updated.bannerUrl).toBe(newKey);
    expect(events).toEqual([
      `copy:${pendingKey}:${newKey}`,
      'db-update',
      `delete:${oldKey}`,
      `delete:${pendingKey}`,
    ]);
    expect(storage.deleteObject).not.toHaveBeenCalledWith(newKey);
  });

  it('does not delete a previous key reactivated between commit and cleanup', async () => {
    const oldKey = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const uploadId = createBannerUploadId('image/png');
    const pendingKey = pendingBannerKeyFromUploadId('user-1', uploadId);
    const newKey = bannerKeyFromUploadId('user-1', uploadId);
    const state = { id: 'user-1', bannerUrl: oldKey };
    const transaction = {
      $queryRaw: vi.fn(async () => [{ locked: 1 }]),
      user: {
        findUnique: vi.fn(async () => ({ ...state })),
        updateMany: vi.fn(async ({ where, data }) => {
          if (state.id !== where.id || state.bannerUrl !== where.bannerUrl) return { count: 0 };
          Object.assign(state, data);
          return { count: 1 };
        }),
      },
    };
    let transactionNumber = 0;
    const prisma = {
      ...transaction,
      $transaction: vi.fn(async (callback) => {
        transactionNumber += 1;
        if (transactionNumber === 2) {
          // A stale completion commits after the first transaction and before
          // the cleanup transaction acquires the same user lock.
          state.bannerUrl = oldKey;
        }
        return callback(transaction);
      }),
    };
    const storage = bannerStorage();

    await expect(completeBannerReplacement({
      prisma,
      storage,
      userId: 'user-1',
      pendingKey,
      newKey,
      logger: { warn: vi.fn() },
    })).resolves.toMatchObject({ bannerUrl: newKey });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
    expect(storage.deleteObject).not.toHaveBeenCalledWith(oldKey);
    expect(storage.deleteObject).not.toHaveBeenCalledWith(newKey);
    expect(storage.deleteObject).toHaveBeenCalledWith(pendingKey);
  });

  it('retains ambiguous candidates for reconciliation when the database update fails', async () => {
    const oldKey = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const uploadId = createBannerUploadId('image/png');
    const pendingKey = pendingBannerKeyFromUploadId('user-1', uploadId);
    const newKey = bannerKeyFromUploadId('user-1', uploadId);
    const prisma = statefulPrisma(
      { id: 'user-1', bannerUrl: oldKey },
      { updateError: new Error('database unavailable') },
    );
    const storage = bannerStorage();

    await expect(completeBannerReplacement({
      prisma,
      storage,
      userId: 'user-1',
      pendingKey,
      newKey,
      logger: { warn: vi.fn() },
    })).rejects.toThrow('database unavailable');
    expect(prisma.state.bannerUrl).toBe(oldKey);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('cleans a proven-invalid upload but retains a raced candidate for reconciliation', async () => {
    const oldKey = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const invalidUploadId = createBannerUploadId('image/png');
    const invalidPendingKey = pendingBannerKeyFromUploadId('user-1', invalidUploadId);
    const invalidKey = bannerKeyFromUploadId('user-1', invalidUploadId);
    const invalidPrisma = statefulPrisma({ id: 'user-1', bannerUrl: oldKey });
    const invalidStorage = bannerStorage({
      getObjectPrefix: vi.fn(async () => Buffer.from('%PDF-1.7')),
    });
    await expect(completeBannerReplacement({
      prisma: invalidPrisma,
      storage: invalidStorage,
      userId: 'user-1',
      pendingKey: invalidPendingKey,
      newKey: invalidKey,
      logger: { warn: vi.fn() },
    })).rejects.toMatchObject({ code: 'PROFILE_BANNER_INVALID' });
    expect(invalidStorage.deleteObject).toHaveBeenCalledWith(invalidPendingKey);
    expect(invalidStorage.deleteObject).not.toHaveBeenCalledWith(invalidKey);
    expect(invalidStorage.deleteObject).not.toHaveBeenCalledWith(oldKey);

    const racedUploadId = createBannerUploadId('image/png');
    const racedPendingKey = pendingBannerKeyFromUploadId('user-1', racedUploadId);
    const racedKey = bannerKeyFromUploadId('user-1', racedUploadId);
    const racedPrisma = statefulPrisma({ id: 'user-1', bannerUrl: oldKey }, { conflict: true });
    const racedStorage = bannerStorage();
    await expect(completeBannerReplacement({
      prisma: racedPrisma,
      storage: racedStorage,
      userId: 'user-1',
      pendingKey: racedPendingKey,
      newKey: racedKey,
      logger: { warn: vi.fn() },
    })).rejects.toMatchObject({ code: 'PROFILE_BANNER_CONFLICT', statusCode: 409 });
    expect(racedStorage.deleteObject).not.toHaveBeenCalled();
  });

  it('never deletes a candidate activated by a concurrent completion', async () => {
    const oldKey = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const uploadId = createBannerUploadId('image/png');
    const pendingKey = pendingBannerKeyFromUploadId('user-1', uploadId);
    const newKey = bannerKeyFromUploadId('user-1', uploadId);
    const prisma = statefulPrisma({ id: 'user-1', bannerUrl: oldKey });
    prisma.user.updateMany.mockImplementationOnce(async () => {
      // Another completion wins between this request's read and CAS update.
      prisma.state.bannerUrl = newKey;
      return { count: 0 };
    });
    const storage = bannerStorage();

    await expect(completeBannerReplacement({
      prisma,
      storage,
      userId: 'user-1',
      pendingKey,
      newKey,
      logger: { warn: vi.fn() },
    })).resolves.toMatchObject({ bannerUrl: newKey });
    expect(storage.deleteObject).toHaveBeenCalledWith(pendingKey);
    expect(storage.deleteObject).not.toHaveBeenCalledWith(newKey);
  });

  it('keeps repeated completion idempotent and only cleans its pending object', async () => {
    const uploadId = createBannerUploadId('image/png');
    const pendingKey = pendingBannerKeyFromUploadId('user-1', uploadId);
    const newKey = bannerKeyFromUploadId('user-1', uploadId);
    const prisma = statefulPrisma({ id: 'user-1', bannerUrl: newKey });
    const storage = bannerStorage();

    await expect(completeBannerReplacement({
      prisma,
      storage,
      userId: 'user-1',
      pendingKey,
      newKey,
      logger: { warn: vi.fn() },
    })).resolves.toMatchObject({ bannerUrl: newKey });
    expect(storage.getObjectMetadata).not.toHaveBeenCalled();
    expect(storage.copyObject).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledWith(pendingKey);
    expect(storage.deleteObject).not.toHaveBeenCalledWith(newKey);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('retains both candidates when promotion fails ambiguously', async () => {
    const uploadId = createBannerUploadId('image/png');
    const pendingKey = pendingBannerKeyFromUploadId('user-1', uploadId);
    const newKey = bannerKeyFromUploadId('user-1', uploadId);
    const prisma = statefulPrisma({ id: 'user-1', bannerUrl: null });
    const storage = bannerStorage({
      copyObject: vi.fn(async () => { throw new Error('copy unavailable'); }),
    });

    await expect(completeBannerReplacement({
      prisma,
      storage,
      userId: 'user-1',
      pendingKey,
      newKey,
      logger: { warn: vi.fn() },
    })).rejects.toMatchObject({
      code: 'PROFILE_BANNER_STORAGE_UNAVAILABLE',
      statusCode: 502,
    });
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('treats a copy error as success when a duplicate completion activated the key', async () => {
    const uploadId = createBannerUploadId('image/png');
    const pendingKey = pendingBannerKeyFromUploadId('user-1', uploadId);
    const newKey = bannerKeyFromUploadId('user-1', uploadId);
    const prisma = statefulPrisma({ id: 'user-1', bannerUrl: null });
    const storage = bannerStorage({
      copyObject: vi.fn(async () => {
        prisma.state.bannerUrl = newKey;
        throw new Error('lost copy response');
      }),
    });

    await expect(completeBannerReplacement({
      prisma,
      storage,
      userId: 'user-1',
      pendingKey,
      newKey,
      logger: { warn: vi.fn() },
    })).resolves.toMatchObject({ bannerUrl: newKey });
    expect(storage.deleteObject).not.toHaveBeenCalledWith(newKey);
  });

  it('never deletes an active candidate when the CAS reconciliation read fails', async () => {
    const oldKey = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const uploadId = createBannerUploadId('image/png');
    const pendingKey = pendingBannerKeyFromUploadId('user-1', uploadId);
    const newKey = bannerKeyFromUploadId('user-1', uploadId);
    const prisma = statefulPrisma({ id: 'user-1', bannerUrl: oldKey }, { conflict: true });
    prisma.user.findUnique
      .mockResolvedValueOnce({ ...prisma.state })
      .mockRejectedValueOnce(new Error('reconciliation unavailable'));
    const storage = bannerStorage();

    await expect(completeBannerReplacement({
      prisma,
      storage,
      userId: 'user-1',
      pendingKey,
      newKey,
      logger: { warn: vi.fn() },
    })).rejects.toThrow('reconciliation unavailable');
    expect(storage.deleteObject).not.toHaveBeenCalledWith(newKey);
    expect(storage.deleteObject).not.toHaveBeenCalledWith(pendingKey);
  });

  it('sweeps only old unreferenced objects from the dedicated active prefix', async () => {
    const now = Date.parse('2026-07-19T00:00:00.000Z');
    const referencedKey = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const orphanKey = bannerKeyFromUploadId('user-2', createBannerUploadId('image/jpeg'));
    const recentKey = bannerKeyFromUploadId('user-3', createBannerUploadId('image/webp'));
    const storage = bannerStorage({
      listObjectsByPrefix: vi.fn(async () => [
        { key: referencedKey, lastModified: new Date(now - (48 * 60 * 60 * 1000)) },
        { key: orphanKey, lastModified: new Date(now - (48 * 60 * 60 * 1000)) },
        { key: recentKey, lastModified: new Date(now - (2 * 60 * 60 * 1000)) },
        { key: `${ACTIVE_BANNER_ROOT}not-a-managed-object`, lastModified: new Date(0) },
      ]),
    });
    const prisma = {
      user: {
        findFirst: vi.fn(async ({ where }) => (
          where.bannerUrl === referencedKey ? { id: where.id } : null
        )),
      },
    };

    await expect(cleanupOrphanedProfileBanners({
      prisma,
      storage,
      now,
      graceMs: 24 * 60 * 60 * 1000,
      logger: { warn: vi.fn() },
    })).resolves.toEqual({ scanned: 4, eligible: 2, deleted: 1 });
    expect(storage.listObjectsByPrefix).toHaveBeenCalledWith(ACTIVE_BANNER_ROOT);
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', bannerUrl: referencedKey },
      select: { id: true },
    });
    expect(storage.deleteObject).toHaveBeenCalledOnce();
    expect(storage.deleteObject).toHaveBeenCalledWith(orphanKey);
  });

  it('rechecks the reference under the same advisory lock used by completion', async () => {
    const now = Date.parse('2026-07-19T00:00:00.000Z');
    const activeKey = bannerKeyFromUploadId('user-race', createBannerUploadId('image/png'));
    let bannerUrl = null;
    const transaction = {
      $queryRaw: vi.fn(async () => []),
      user: {
        findFirst: vi.fn(async ({ where }) => (
          bannerUrl === where.bannerUrl ? { id: where.id } : null
        )),
      },
    };
    const prisma = {
      user: transaction.user,
      $transaction: vi.fn(async (callback) => {
        // Simulate completion activating the key after the object listing but
        // before the sweeper acquires its per-user advisory lock.
        bannerUrl = activeKey;
        return callback(transaction);
      }),
    };
    const storage = bannerStorage({
      listObjectsByPrefix: vi.fn(async () => [{
        key: activeKey,
        lastModified: new Date(now - (48 * 60 * 60 * 1000)),
      }]),
    });

    await expect(cleanupOrphanedProfileBanners({
      prisma,
      storage,
      now,
      graceMs: 24 * 60 * 60 * 1000,
      logger: { warn: vi.fn() },
    })).resolves.toEqual({ scanned: 1, eligible: 1, deleted: 0 });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('removes only a database-derived owned object and ignores legacy URLs', async () => {
    const ownedKey = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const ownedPrisma = statefulPrisma({ id: 'user-1', bannerUrl: ownedKey });
    const ownedStorage = bannerStorage();
    const removed = await removeProfileBanner({
      prisma: ownedPrisma,
      storage: ownedStorage,
      userId: 'user-1',
      logger: { warn: vi.fn() },
    });
    expect(removed.bannerUrl).toBeNull();
    expect(ownedStorage.deleteObject).toHaveBeenCalledWith(ownedKey);

    const legacyPrisma = statefulPrisma({
      id: 'user-1',
      bannerUrl: 'https://images.example/legacy.jpg',
    });
    const legacyStorage = bannerStorage();
    await removeProfileBanner({
      prisma: legacyPrisma,
      storage: legacyStorage,
      userId: 'user-1',
      logger: { warn: vi.fn() },
    });
    expect(legacyStorage.deleteObject).not.toHaveBeenCalled();
  });

  it('is idempotent with no banner and never deletes a foreign managed key', async () => {
    const emptyPrisma = statefulPrisma({ id: 'user-1', bannerUrl: null });
    const emptyStorage = bannerStorage();
    await expect(removeProfileBanner({
      prisma: emptyPrisma,
      storage: emptyStorage,
      userId: 'user-1',
      logger: { warn: vi.fn() },
    })).resolves.toMatchObject({ bannerUrl: null });
    expect(emptyPrisma.user.updateMany).not.toHaveBeenCalled();
    expect(emptyStorage.deleteObject).not.toHaveBeenCalled();

    const foreignKey = bannerKeyFromUploadId('user-2', createBannerUploadId('image/png'));
    const corruptPrisma = statefulPrisma({ id: 'user-1', bannerUrl: foreignKey });
    const corruptStorage = bannerStorage();
    await removeProfileBanner({
      prisma: corruptPrisma,
      storage: corruptStorage,
      userId: 'user-1',
      logger: { warn: vi.fn() },
    });
    expect(corruptPrisma.state.bannerUrl).toBeNull();
    expect(corruptStorage.deleteObject).not.toHaveBeenCalled();
  });

  it('serializes owned keys to stable same-origin media paths and never returns foreign raw keys', async () => {
    const storage = bannerStorage();
    const ownedKey = bannerKeyFromUploadId('user-1', createBannerUploadId('image/png'));
    const foreignKey = bannerKeyFromUploadId('user-2', createBannerUploadId('image/png'));
    await expect(resolveBannerUrl(storage, { id: 'user-1', bannerUrl: ownedKey }))
      .resolves.toBe(`/api/public/profile-banners/user-1/${ownedKey.split('/').pop()}`);
    await expect(resolveBannerUrl(storage, { id: 'user-1', bannerUrl: foreignKey }))
      .resolves.toBeNull();
    await expect(resolveBannerUrl(storage, { id: 'user-1', bannerUrl: '//evil.example/banner.png' }))
      .resolves.toBeNull();
    await expect(resolveBannerUrl(storage, { id: 'user-1', bannerUrl: '/\\evil.example/banner.png' }))
      .resolves.toBeNull();
    await expect(resolveBannerUrl(storage, {
      id: 'user-1',
      bannerUrl: 'https://images.example/legacy.jpg',
    })).resolves.toBe('https://images.example/legacy.jpg');
    expect(storage.getPublicOrSignedUrl).not.toHaveBeenCalled();
  });
});
