'use strict';

const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const backendPackage = require('../../package.json');
const {
  adminReadOptions,
  adminMutationOptions,
  sendAdminError,
  requiredReason
} = require('../lib/adminGuard');
const {
  parsePagination,
  paginationMeta,
  sanitizeSearch,
  enumFilter
} = require('../lib/pagination');
const { auditData, createAudit, redactAuditMetadata } = require('../lib/auditLog');
const {
  ARTIST_ACCESS_USER_SELECT,
  summarizeArtistAccess,
  ensureArtistProfile,
  grantArtistAccess,
  revokeArtistAccess
} = require('../lib/artistAccess');
const {
  recalculateAllArtistMonthlyListeners,
  recalculateArtistMonthlyListeners,
  recalculateAllTrackPlayCounts
} = require('../lib/statsAccess');
const { runStatsIntegrityCheck } = require('../lib/statsIntegrity');
const { hasLyrics } = require('../lib/lyrics');

const execFileAsync = promisify(execFile);
const USER_ROLES = ['LISTENER', 'ARTIST', 'ADMIN'];
const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'];
const TRACK_STATUSES = ['DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'PUBLISHED', 'FAILED', 'REJECTED', 'HIDDEN'];
const UPLOAD_STATUSES = ['INITIATED', 'UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED'];
const REPORT_STATUSES = ['OPEN', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN', 'ESCALATED'];
const REPORT_TARGET_TYPES = ['TRACK', 'COMMENT', 'USER', 'ARTIST', 'PLAYLIST'];
const COMMENT_SELECT = {
  id: true,
  trackId: true,
  userId: true,
  text: true,
  likes: true,
  parentId: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true
};

function invalidFilter(reply, field) {
  return sendAdminError(reply, 400, 'ADMIN_INVALID_FILTER', `Invalid ${field} filter.`);
}

function maskObjectReference(key) {
  if (!key || typeof key !== 'string') return null;
  const fileName = key.split('/').pop();
  return fileName ? `…/${fileName.slice(-80)}` : '…';
}

function publicUpload(upload) {
  if (!upload) return null;
  const {
    uploadUrl: _uploadUrl,
    storageKey,
    coverStorageKey,
    ...safe
  } = upload;
  return {
    ...safe,
    storageRef: maskObjectReference(storageKey),
    coverStorageRef: maskObjectReference(coverStorageKey)
  };
}

function publicAudit(log) {
  return {
    ...log,
    metadata: redactAuditMetadata(log.metadata)
  };
}

async function queueStatus(fastify) {
  if (!fastify.audioQueue || typeof fastify.audioQueue.getJobCounts !== 'function') {
    return { status: 'unavailable', counts: null };
  }
  try {
    const counts = await fastify.audioQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );
    return { status: 'ok', counts };
  } catch {
    return { status: 'error', counts: null };
  }
}

async function systemChecks(fastify) {
  const checks = {
    api: 'ok',
    database: 'unknown',
    redis: 'unknown',
    storage: 'unknown',
    worker: 'unknown',
    ffmpeg: 'unknown'
  };

  try {
    await fastify.prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  const queue = await queueStatus(fastify);
  checks.worker = queue.status;
  if (fastify.audioQueue?.client) {
    try {
      const redis = await fastify.audioQueue.client;
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }
  } else {
    checks.redis = 'unavailable';
  }

  try {
    if (typeof fastify.storage?.checkHealth !== 'function') throw new Error('unavailable');
    await fastify.storage.checkHealth();
    checks.storage = 'ok';
  } catch (error) {
    checks.storage = error.message === 'unavailable' ? 'unavailable' : 'error';
  }

  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 3000, maxBuffer: 16 * 1024 });
    checks.ffmpeg = 'ok';
  } catch {
    checks.ffmpeg = 'unavailable';
  }

  const ready = ['api', 'database', 'storage'].every((name) => checks[name] === 'ok');
  return { ready, checks, queue };
}

async function reportTargetContext(prisma, report) {
  if (!report) return null;
  switch (report.targetType) {
    case 'TRACK':
      return prisma.track.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          title: true,
          status: true,
          artist: { select: { id: true, user: { select: { id: true, username: true, displayName: true } } } }
        }
      });
    case 'COMMENT':
      return prisma.comment.findUnique({
        where: { id: report.targetId },
        select: {
          ...COMMENT_SELECT,
          user: { select: { id: true, username: true, displayName: true, status: true } },
          track: { select: { id: true, title: true, status: true } }
        }
      });
    case 'USER':
      return prisma.user.findUnique({
        where: { id: report.targetId },
        select: { id: true, username: true, displayName: true, role: true, status: true, joinedAt: true }
      });
    case 'ARTIST':
      return prisma.artistProfile.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          isHidden: true,
          user: { select: { id: true, username: true, displayName: true, status: true } }
        }
      });
    case 'PLAYLIST':
      return prisma.playlist.findUnique({
        where: { id: report.targetId },
        select: { id: true, name: true, isPublic: true, creatorId: true }
      });
    default:
      return null;
  }
}

async function enqueueUpload(fastify, upload, actorId, reason, action) {
  const objectExists = typeof fastify.storage?.objectExists === 'function'
    ? await fastify.storage.objectExists(upload.storageKey)
    : (await fastify.storage.getObjectMetadata(upload.storageKey)).exists;
  if (!objectExists) {
    const error = new Error('The original audio object is unavailable.');
    error.code = 'ADMIN_UPLOAD_OBJECT_MISSING';
    throw error;
  }

  await fastify.prisma.$transaction(async (tx) => {
    await tx.upload.update({
      where: { id: upload.id },
      data: { status: 'PROCESSING', processingError: null, errorMessage: null }
    });
    if (upload.trackId) {
      await tx.track.update({ where: { id: upload.trackId }, data: { status: 'PROCESSING' } });
    }
    await createAudit(tx, auditData(actorId, action, 'UPLOAD', upload.id, reason, {
      trackId: upload.trackId || null
    }));
  });

  try {
    const job = await fastify.audioQueue.add(
      'processAudio',
      { uploadId: upload.id, storageKey: upload.storageKey },
      {
        jobId: `admin-reprocess-${upload.id}-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: false
      }
    );
    return job.id;
  } catch (error) {
    await fastify.prisma.$transaction([
      fastify.prisma.upload.update({
        where: { id: upload.id },
        data: { status: 'FAILED', errorMessage: 'Audio processing could not be queued.' }
      }),
      ...(upload.trackId ? [fastify.prisma.track.update({
        where: { id: upload.trackId },
        data: { status: 'FAILED' }
      })] : [])
    ]);
    throw error;
  }
}

async function adminRoutes(fastify) {
  const read = adminReadOptions(fastify);
  const mutate = adminMutationOptions(fastify);

  // This handler is scoped to /api/admin and never returns an internal stack or
  // raw database/queue error to the browser.
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Admin API request failed');
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'RATE_LIMITED',
        message: 'Too many admin actions. Please try again later.'
      });
    }
    return reply.status(500).send({
      error: 'ADMIN_INTERNAL_ERROR',
      message: 'The admin operation could not be completed.'
    });
  });

  // --- Overview ------------------------------------------------------------

  fastify.get('/overview', read, async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [
      usersTotal,
      usersActive,
      usersSuspended,
      usersBanned,
      tracksTotal,
      tracksPublished,
      tracksHidden,
      tracksRejected,
      tracksProcessing,
      tracksFailed,
      uploadsTotal,
      uploadsPending,
      uploadsProcessing,
      uploadsFailed,
      uploadsReady,
      reportsPending,
      reportsResolved,
      reportsRejected,
      commentsTotal,
      commentsHidden,
      commentsToday,
      playEvents,
      playEventsToday,
      trackedStorage
    ] = await Promise.all([
      fastify.prisma.user.count(),
      fastify.prisma.user.count({ where: { status: 'ACTIVE' } }),
      fastify.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      fastify.prisma.user.count({ where: { status: 'BANNED' } }),
      fastify.prisma.track.count(),
      fastify.prisma.track.count({ where: { status: 'PUBLISHED' } }),
      fastify.prisma.track.count({ where: { status: 'HIDDEN' } }),
      fastify.prisma.track.count({ where: { status: 'REJECTED' } }),
      fastify.prisma.track.count({ where: { status: 'PROCESSING' } }),
      fastify.prisma.track.count({ where: { status: 'FAILED' } }),
      fastify.prisma.upload.count(),
      fastify.prisma.upload.count({ where: { status: { in: ['INITIATED', 'UPLOADING'] } } }),
      fastify.prisma.upload.count({ where: { status: 'PROCESSING' } }),
      fastify.prisma.upload.count({ where: { status: 'FAILED' } }),
      fastify.prisma.upload.count({ where: { status: 'READY' } }),
      fastify.prisma.report.count({ where: { status: { in: ['OPEN', 'ESCALATED'] } } }),
      fastify.prisma.report.count({ where: { status: { in: ['REVIEWED', 'ACTION_TAKEN'] } } }),
      fastify.prisma.report.count({ where: { status: 'DISMISSED' } }),
      fastify.prisma.comment.count(),
      fastify.prisma.comment.count({ where: { isDeleted: true } }),
      fastify.prisma.comment.count({ where: { createdAt: { gte: today } } }),
      fastify.prisma.playEvent.count(),
      fastify.prisma.playEvent.count({ where: { createdAt: { gte: today } } }),
      fastify.prisma.upload.aggregate({ _sum: { sizeBytes: true, coverSizeBytes: true } })
    ]);
    const system = await systemChecks(fastify);
    return {
      users: { total: usersTotal, active: usersActive, suspended: usersSuspended, banned: usersBanned },
      tracks: {
        total: tracksTotal,
        published: tracksPublished,
        hidden: tracksHidden,
        rejected: tracksRejected,
        processing: tracksProcessing,
        failed: tracksFailed
      },
      uploads: {
        total: uploadsTotal,
        pending: uploadsPending,
        processing: uploadsProcessing,
        failed: uploadsFailed,
        ready: uploadsReady
      },
      reports: { pending: reportsPending, resolved: reportsResolved, rejected: reportsRejected },
      comments: { total: commentsTotal, hidden: commentsHidden, today: commentsToday },
      playEvents: { total: playEvents, today: playEventsToday },
      storage: {
        trackedBytes: (trackedStorage._sum.sizeBytes || 0) + (trackedStorage._sum.coverSizeBytes || 0),
        providerUsageBytes: null
      },
      system: { status: system.ready ? 'ready' : 'degraded', checks: system.checks, queue: system.queue }
    };
  });
  fastify.get('/summary', read, async (request, reply) => {
    const result = await fastify.inject({
      method: 'GET',
      url: '/api/admin/overview',
      headers: { cookie: request.headers.cookie || '' }
    });
    if (result.statusCode !== 200) {
      return sendAdminError(reply, result.statusCode, 'ADMIN_OVERVIEW_FAILED', 'Overview is unavailable.');
    }
    const overview = result.json();
    return {
      openReports: overview.reports.pending,
      hiddenTracks: overview.tracks.hidden,
      suspendedUsers: overview.users.suspended
    };
  });

  // --- Users ---------------------------------------------------------------

  fastify.get('/users', read, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const search = sanitizeSearch(request.query.search);
    const role = enumFilter(request.query.role, USER_ROLES);
    const status = enumFilter(request.query.status, USER_STATUSES);
    if (request.query.role && role === undefined) return invalidFilter(reply, 'role');
    if (request.query.status && status === undefined) return invalidFilter(reply, 'status');

    // Tri-state (unset / 'true' / 'false') artist-access filters. Anything
    // else in the query string is treated as unset rather than rejected, so
    // the UI can always round-trip an empty "all" option.
    const hasArtistProfile = request.query.hasArtistProfile === 'true'
      ? true
      : request.query.hasArtistProfile === 'false' ? false : undefined;
    const uploadBlocked = request.query.uploadBlocked === 'true'
      ? true
      : request.query.uploadBlocked === 'false' ? false : undefined;

    const allowedSort = ['updatedAt', 'id', 'email', 'joinedAt'];
    const sortBy = allowedSort.includes(request.query.sortBy) ? request.query.sortBy : 'updatedAt';
    const sortOrder = request.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const andConditions = [];
    if (hasArtistProfile !== undefined) {
      andConditions.push({ artistProfile: hasArtistProfile ? { isNot: null } : { is: null } });
    }
    if (uploadBlocked !== undefined) {
      // canUploadTracks is computed, not stored — express the same rule
      // (see artistAccess.evaluateUploadAccess) as a Prisma filter so
      // pagination stays correct at the database level.
      const canUploadWhere = {
        status: 'ACTIVE',
        role: { in: ['ARTIST', 'ADMIN'] },
        artistProfile: { is: { isHidden: false } }
      };
      andConditions.push(uploadBlocked ? { NOT: canUploadWhere } : canUploadWhere);
    }

    const where = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } }
        ]
      } : {}),
      ...(andConditions.length ? { AND: andConditions } : {})
    };
    const [total, users] = await fastify.prisma.$transaction([
      fastify.prisma.user.count({ where }),
      fastify.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          status: true,
          joinedAt: true,
          updatedAt: true,
          artistProfile: {
            select: { id: true, isHidden: true, _count: { select: { tracks: true } } }
          },
          _count: { select: { reportsMade: true, comments: true, uploads: true, sessions: true } }
        }
      })
    ]);
    return {
      data: users.map((user) => ({
        ...user,
        counts: {
          tracks: user.artistProfile?._count.tracks || 0,
          reports: user._count.reportsMade,
          comments: user._count.comments,
          uploads: user._count.uploads,
          sessions: user._count.sessions
        },
        artistProfile: user.artistProfile
          ? { id: user.artistProfile.id, isHidden: user.artistProfile.isHidden }
          : null,
        ...summarizeArtistAccess(user),
        _count: undefined
      })),
      pagination: paginationMeta(total, page, pageSize)
    };
  });

  fastify.get('/users/:id', read, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        location: true,
        preferredLanguage: true,
        role: true,
        status: true,
        joinedAt: true,
        updatedAt: true,
        artistProfile: {
          select: {
            id: true,
            isHidden: true,
            genres: true,
            monthlyListeners: true,
            tracks: {
              take: 50,
              orderBy: { updatedAt: 'desc' },
              select: { id: true, title: true, status: true, plays: true, updatedAt: true }
            }
          }
        },
        uploads: {
          take: 25,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            trackId: true,
            type: true,
            status: true,
            originalFileName: true,
            mimeType: true,
            sizeBytes: true,
            processingError: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true
          }
        },
        comments: {
          take: 25,
          orderBy: { createdAt: 'desc' },
          select: COMMENT_SELECT
        },
        reportsMade: {
          take: 25,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            targetType: true,
            targetId: true,
            reason: true,
            details: true,
            status: true,
            createdAt: true
          }
        },
        _count: { select: { sessions: true, uploads: true, comments: true, reportsMade: true } }
      }
    });
    if (!user) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    const [reportsAgainst, audit] = await Promise.all([
      fastify.prisma.report.findMany({
        where: { targetType: 'USER', targetId: user.id },
        take: 25,
        orderBy: { createdAt: 'desc' },
        include: { reporter: { select: { id: true, username: true, displayName: true } } }
      }),
      fastify.prisma.auditLog.findMany({
        where: { targetType: 'USER', targetId: user.id },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, username: true, displayName: true } } }
      })
    ]);
    return {
      user: {
        ...user,
        sessions: { active: user._count.sessions },
        counts: user._count,
        ...summarizeArtistAccess(user),
        _count: undefined
      },
      reportsAgainst,
      audit: audit.map(publicAudit)
    };
  });

  fastify.patch('/users/:id', mutate, async (request, reply) => {
    const body = request.body || {};
    const reason = requiredReason(body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const target = await fastify.prisma.user.findUnique({ where: { id: request.params.id } });
    if (!target) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    const data = {};
    if (typeof body.displayName === 'string' && body.displayName.trim() && body.displayName.trim().length <= 100) {
      data.displayName = body.displayName.trim();
    }
    if (typeof body.username === 'string' && /^[a-zA-Z0-9_]{3,30}$/.test(body.username)) {
      data.username = body.username;
    }
    if (Object.keys(data).length === 0) {
      return sendAdminError(reply, 400, 'ADMIN_INVALID_INPUT', 'No valid editable fields were provided.');
    }
    const updated = await fastify.prisma.$transaction(async (tx) => {
      const changed = await tx.user.update({
        where: { id: target.id },
        data,
        select: { id: true, email: true, username: true, displayName: true, role: true, status: true, updatedAt: true }
      });
      await createAudit(tx, auditData(request.user.id, 'USER_UPDATE', 'USER', target.id, reason, {
        fields: Object.keys(data)
      }));
      return changed;
    });
    return { user: updated };
  });

  async function changeUserStatus(request, reply, nextStatus, action, allowedCurrent) {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const target = await fastify.prisma.user.findUnique({ where: { id: request.params.id } });
    if (!target) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    if (target.id === request.user.id && ['SUSPENDED', 'BANNED'].includes(nextStatus)) {
      return sendAdminError(reply, 409, 'ADMIN_SELF_ACTION_BLOCKED', 'You cannot suspend or ban your own account.');
    }
    if (target.role === 'ADMIN' && ['SUSPENDED', 'BANNED'].includes(nextStatus)) {
      return sendAdminError(reply, 409, 'ADMIN_ADMIN_STATUS_BLOCKED', 'Change the admin role before restricting this account.');
    }
    if (!allowedCurrent.includes(target.status)) {
      return sendAdminError(reply, 409, 'ADMIN_INVALID_STATE', `User status cannot change from ${target.status} to ${nextStatus}.`);
    }
    await fastify.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { status: nextStatus } });
      if (['SUSPENDED', 'BANNED'].includes(nextStatus)) {
        await tx.session.deleteMany({ where: { userId: target.id } });
      }
      await createAudit(tx, auditData(request.user.id, action, 'USER', target.id, reason, {
        previousStatus: target.status,
        nextStatus
      }));
    });
    return { user: { id: target.id, status: nextStatus } };
  }

  fastify.post('/users/:id/suspend', mutate, (request, reply) =>
    changeUserStatus(request, reply, 'SUSPENDED', 'USER_SUSPEND', ['ACTIVE']));
  fastify.post('/users/:id/unsuspend', mutate, (request, reply) =>
    changeUserStatus(request, reply, 'ACTIVE', 'USER_UNSUSPEND', ['SUSPENDED']));
  fastify.post('/users/:id/ban', mutate, (request, reply) =>
    changeUserStatus(request, reply, 'BANNED', 'USER_BAN', ['ACTIVE', 'SUSPENDED']));
  fastify.post('/users/:id/unban', mutate, (request, reply) =>
    changeUserStatus(request, reply, 'ACTIVE', 'USER_UNBAN', ['BANNED']));

  fastify.post('/users/:id/revoke-sessions', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: { id: true }
    });
    if (!target) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    const revoked = await fastify.prisma.$transaction(async (tx) => {
      const result = await tx.session.deleteMany({ where: { userId: target.id } });
      await createAudit(tx, auditData(request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
        revokedCount: result.count
      }));
      return result.count;
    });
    return { userId: target.id, revokedSessions: revoked };
  });

  fastify.post('/users/:id/set-role', mutate, async (request, reply) => {
    const role = enumFilter(request.body?.role, USER_ROLES);
    const reason = requiredReason(request.body);
    if (!role) return sendAdminError(reply, 400, 'ADMIN_INVALID_ROLE', 'A valid role is required.');
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    if (request.body?.confirmation !== 'SET_ROLE') {
      return sendAdminError(reply, 400, 'ADMIN_CONFIRMATION_REQUIRED', 'Role changes require explicit confirmation.');
    }
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      include: { artistProfile: { select: { id: true, isHidden: true } } }
    });
    if (!target) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    if (target.role === role) return { user: { id: target.id, role, ...summarizeArtistAccess(target) } };
    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await fastify.prisma.user.count({
        where: { role: 'ADMIN', status: 'ACTIVE' }
      });
      if (adminCount <= 1) {
        return sendAdminError(reply, 409, 'ADMIN_LAST_ADMIN', 'The last active admin cannot be demoted.');
      }
    }

    // Artist-profile side effects. Defaults mirror Phase 9 of the artist
    // access brief: moving a user *to* ARTIST auto-creates a profile unless
    // explicitly disabled; moving a user *to* ADMIN never auto-creates one
    // unless explicitly requested (an admin does not need upload access by
    // default); moving a user *away from* ARTIST never hides the profile
    // unless explicitly requested ("ask whether to hide"). Omitting these
    // fields entirely (older/scripted callers) reproduces the exact
    // pre-existing behavior below.
    const createArtistProfile = role === 'ARTIST'
      ? request.body?.createArtistProfile !== false
      : role === 'ADMIN' && request.body?.createArtistProfile === true;
    const hideArtistProfile = target.role === 'ARTIST' && role !== 'ARTIST' &&
      request.body?.hideArtistProfile === true;
    const revokeSessions = typeof request.body?.revokeSessions === 'boolean'
      ? request.body.revokeSessions
      : role !== 'ADMIN';

    const result = await fastify.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { role } });
      await createAudit(tx, auditData(request.user.id, 'USER_SET_ROLE', 'USER', target.id, reason, {
        previousRole: target.role,
        nextRole: role,
        requestId: request.id
      }));

      let profile = target.artistProfile;
      if (createArtistProfile && !profile) {
        const ensured = await ensureArtistProfile(tx, target.id);
        profile = ensured.profile;
        if (ensured.created) {
          await createAudit(tx, auditData(request.user.id, 'ARTIST_PROFILE_CREATED', 'ARTIST', ensured.profile.id, reason, {
            userId: target.id,
            triggeredBy: 'USER_SET_ROLE'
          }));
        }
      } else if (hideArtistProfile && profile && !profile.isHidden) {
        profile = await tx.artistProfile.update({ where: { id: profile.id }, data: { isHidden: true } });
        await createAudit(tx, auditData(request.user.id, 'ARTIST_HIDE', 'ARTIST', profile.id, reason, {
          userId: target.id,
          triggeredBy: 'USER_SET_ROLE'
        }));
      }

      if (revokeSessions) {
        const revoked = await tx.session.deleteMany({ where: { userId: target.id } });
        await createAudit(tx, auditData(request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
          revokedCount: revoked.count,
          triggeredBy: 'USER_SET_ROLE'
        }));
      }

      return { role, status: target.status, artistProfile: profile };
    });

    return { user: { id: target.id, ...result, ...summarizeArtistAccess(result) } };
  });

  // --- Artist access ---------------------------------------------------------
  //
  // Composite operations layered on top of the primitives above: granting or
  // revoking artist upload access bundles a role change, an ArtistProfile
  // create/hide, and an optional session revocation into one auditable admin
  // action. See backend/src/lib/artistAccess.js for the shared rules.

  fastify.post('/users/:id/grant-artist', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    if (request.user.status !== 'ACTIVE') {
      return sendAdminError(reply, 403, 'ADMIN_NOT_ACTIVE', 'Your admin account is not active.');
    }
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: ARTIST_ACCESS_USER_SELECT
    });
    if (!target) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    if (target.status === 'BANNED') {
      return sendAdminError(reply, 409, 'ADMIN_USER_BANNED', 'Unban this user before granting artist access.');
    }
    if (target.status === 'DELETED') {
      return sendAdminError(reply, 409, 'ADMIN_USER_DELETED', 'This account is deleted and cannot be granted artist access.');
    }

    const options = {
      createProfile: request.body?.createProfile !== false,
      revokeSessions: request.body?.revokeSessions !== false
    };

    const outcome = await fastify.prisma.$transaction(async (tx) => {
      const diff = await grantArtistAccess(tx, target, options);

      if (diff.roleChanged) {
        await createAudit(tx, auditData(request.user.id, 'USER_SET_ROLE', 'USER', target.id, reason, {
          previousRole: diff.previousRole,
          nextRole: diff.nextRole,
          triggeredBy: 'USER_GRANT_ARTIST'
        }));
      }
      if (diff.profileCreated) {
        await createAudit(tx, auditData(request.user.id, 'ARTIST_PROFILE_CREATED', 'ARTIST', diff.profile.id, reason, {
          userId: target.id,
          triggeredBy: 'USER_GRANT_ARTIST'
        }));
      }
      if (diff.profileUnhiddenNow) {
        await createAudit(tx, auditData(request.user.id, 'ARTIST_UNHIDE', 'ARTIST', diff.profile.id, reason, {
          userId: target.id,
          triggeredBy: 'USER_GRANT_ARTIST'
        }));
      }
      if (diff.sessionsRevoked) {
        await createAudit(tx, auditData(request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
          revokedCount: diff.revokedSessionCount,
          triggeredBy: 'USER_GRANT_ARTIST'
        }));
      }
      await createAudit(tx, auditData(request.user.id, 'USER_GRANT_ARTIST', 'USER', target.id, reason, {
        previousRole: diff.previousRole,
        nextRole: diff.nextRole,
        previousStatus: diff.previousStatus,
        nextStatus: diff.nextStatus,
        artistProfileId: diff.profile?.id || null,
        artistProfileCreated: diff.profileCreated,
        artistProfileUnhidden: diff.profileUnhiddenNow,
        sessionsRevoked: diff.sessionsRevoked,
        requestId: request.id
      }));

      return diff;
    });

    return {
      user: {
        id: target.id,
        email: target.email,
        username: target.username,
        displayName: target.displayName,
        role: outcome.nextRole,
        status: outcome.nextStatus,
        ...summarizeArtistAccess({ role: outcome.nextRole, status: outcome.nextStatus, artistProfile: outcome.profile })
      }
    };
  });

  fastify.post('/users/:id/revoke-artist', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    if (request.user.status !== 'ACTIVE') {
      return sendAdminError(reply, 403, 'ADMIN_NOT_ACTIVE', 'Your admin account is not active.');
    }
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: ARTIST_ACCESS_USER_SELECT
    });
    if (!target) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    // Revoking artist access never demotes an admin — only role ARTIST is
    // ever changed by this endpoint (see artistAccess.revokeArtistAccess),
    // so the last-active-admin guard used by set-role does not apply here.

    const options = {
      hideArtistProfile: request.body?.hideArtistProfile !== false,
      revokeSessions: request.body?.revokeSessions !== false
    };

    const outcome = await fastify.prisma.$transaction(async (tx) => {
      const diff = await revokeArtistAccess(tx, target, options);

      if (diff.roleChanged) {
        await createAudit(tx, auditData(request.user.id, 'USER_SET_ROLE', 'USER', target.id, reason, {
          previousRole: diff.previousRole,
          nextRole: diff.nextRole,
          triggeredBy: 'USER_REVOKE_ARTIST'
        }));
      }
      if (diff.profileHiddenNow) {
        await createAudit(tx, auditData(request.user.id, 'ARTIST_HIDE', 'ARTIST', diff.profile.id, reason, {
          userId: target.id,
          triggeredBy: 'USER_REVOKE_ARTIST'
        }));
      }
      if (diff.sessionsRevoked) {
        await createAudit(tx, auditData(request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
          revokedCount: diff.revokedSessionCount,
          triggeredBy: 'USER_REVOKE_ARTIST'
        }));
      }
      await createAudit(tx, auditData(request.user.id, 'USER_REVOKE_ARTIST', 'USER', target.id, reason, {
        previousRole: diff.previousRole,
        nextRole: diff.nextRole,
        artistProfileId: diff.profile?.id || null,
        artistProfileHiddenNow: diff.profileHiddenNow,
        sessionsRevoked: diff.sessionsRevoked,
        requestId: request.id
      }));

      return diff;
    });

    return {
      user: {
        id: target.id,
        email: target.email,
        username: target.username,
        displayName: target.displayName,
        role: outcome.nextRole,
        status: target.status,
        ...summarizeArtistAccess({ role: outcome.nextRole, status: target.status, artistProfile: outcome.profile })
      }
    };
  });

  fastify.post('/users/:id/ensure-artist-profile', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    if (request.user.status !== 'ACTIVE') {
      return sendAdminError(reply, 403, 'ADMIN_NOT_ACTIVE', 'Your admin account is not active.');
    }
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: ARTIST_ACCESS_USER_SELECT
    });
    if (!target) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    const revokeSessions = request.body?.revokeSessions === true;

    const result = await fastify.prisma.$transaction(async (tx) => {
      const ensured = await ensureArtistProfile(tx, target.id);
      await createAudit(tx, auditData(request.user.id, 'ARTIST_PROFILE_CREATED', 'ARTIST', ensured.profile.id, reason, {
        userId: target.id,
        alreadyExisted: !ensured.created,
        triggeredBy: 'USER_ENSURE_ARTIST_PROFILE',
        requestId: request.id
      }));
      let revokedSessionCount = null;
      if (revokeSessions) {
        const revoked = await tx.session.deleteMany({ where: { userId: target.id } });
        revokedSessionCount = revoked.count;
        await createAudit(tx, auditData(request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
          revokedCount: revoked.count,
          triggeredBy: 'USER_ENSURE_ARTIST_PROFILE'
        }));
      }
      return { profile: ensured.profile, created: ensured.created, revokedSessionCount };
    });

    return {
      user: {
        id: target.id,
        email: target.email,
        username: target.username,
        displayName: target.displayName,
        role: target.role,
        status: target.status,
        ...summarizeArtistAccess({ role: target.role, status: target.status, artistProfile: result.profile })
      },
      artistProfile: result.profile,
      created: result.created
    };
  });

  // --- Tracks --------------------------------------------------------------

  fastify.get('/tracks', read, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const search = sanitizeSearch(request.query.search);
    const status = enumFilter(request.query.status, TRACK_STATUSES);
    if (request.query.status && status === undefined) return invalidFilter(reply, 'status');
    const where = {
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { genre: { contains: search, mode: 'insensitive' } },
          { artist: { user: { displayName: { contains: search, mode: 'insensitive' } } } },
          { artist: { user: { username: { contains: search, mode: 'insensitive' } } } }
        ]
      } : {})
    };
    const [total, tracks] = await fastify.prisma.$transaction([
      fastify.prisma.track.count({ where }),
      fastify.prisma.track.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: request.query.sortOrder === 'asc' ? 'asc' : 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          genre: true,
          status: true,
          plays: true,
          likes: true,
          coverUrl: true,
          createdAt: true,
          updatedAt: true,
          artist: {
            select: {
              id: true,
              isHidden: true,
              user: { select: { id: true, username: true, displayName: true, status: true } }
            }
          },
          uploads: {
            take: 1,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, status: true }
          },
          _count: { select: { comments: true } }
        }
      })
    ]);
    const ids = tracks.map((track) => track.id);
    const grouped = ids.length
      ? await fastify.prisma.report.groupBy({
        by: ['targetId'],
        where: { targetType: 'TRACK', targetId: { in: ids } },
        _count: { _all: true }
      })
      : [];
    const reportCounts = new Map(grouped.map((row) => [row.targetId, row._count._all]));
    return {
      data: tracks.map((track) => ({
        ...track,
        commentsCount: track._count.comments,
        reportsCount: reportCounts.get(track.id) || 0,
        _count: undefined
      })),
      pagination: paginationMeta(total, page, pageSize)
    };
  });

  fastify.get('/tracks/:id', read, async (request, reply) => {
    const track = await fastify.prisma.track.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        title: true,
        slug: true,
        coverUrl: true,
        genre: true,
        tags: true,
        durationSeconds: true,
        description: true,
        status: true,
        plays: true,
        likes: true,
        mimeType: true,
        fileSize: true,
        copyrightConfirmed: true,
        lyricsText: true,
        lyricsType: true,
        lyricsLanguage: true,
        lyricsSynced: true,
        lyricsRightsConfirmed: true,
        lyricsUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        processedAudioKey: true,
        artist: {
          select: {
            id: true,
            isHidden: true,
            user: { select: { id: true, username: true, displayName: true, status: true } }
          }
        },
        uploads: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            userId: true,
            trackId: true,
            type: true,
            status: true,
            originalFileName: true,
            storageKey: true,
            mimeType: true,
            sizeBytes: true,
            processingError: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true
          }
        },
        _count: { select: { comments: true, playEvents: true } }
      }
    });
    if (!track) return sendAdminError(reply, 404, 'ADMIN_TRACK_NOT_FOUND', 'Track not found.');
    const [reports, audit] = await Promise.all([
      fastify.prisma.report.findMany({
        where: { targetType: 'TRACK', targetId: track.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { reporter: { select: { id: true, username: true, displayName: true } } }
      }),
      fastify.prisma.auditLog.findMany({
        where: { targetType: 'TRACK', targetId: track.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actor: { select: { id: true, username: true, displayName: true } } }
      })
    ]);
    const { processedAudioKey, uploads, ...safeTrack } = track;
    return {
      track: {
        ...safeTrack,
        hasLyrics: hasLyrics(track),
        streamAvailable: Boolean(processedAudioKey && track.status === 'PUBLISHED'),
        uploads: uploads.map(publicUpload)
      },
      reports,
      audit: audit.map(publicAudit)
    };
  });

  async function setTrackStatus(request, reply, nextStatus, action, allowedCurrent) {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const track = await fastify.prisma.track.findUnique({ where: { id: request.params.id } });
    if (!track) return sendAdminError(reply, 404, 'ADMIN_TRACK_NOT_FOUND', 'Track not found.');
    if (!allowedCurrent.includes(track.status)) {
      return sendAdminError(reply, 409, 'ADMIN_INVALID_STATE', `Track status cannot change from ${track.status} to ${nextStatus}.`);
    }
    await fastify.prisma.$transaction(async (tx) => {
      await tx.track.update({ where: { id: track.id }, data: { status: nextStatus } });
      await createAudit(tx, auditData(request.user.id, action, 'TRACK', track.id, reason, {
        previousStatus: track.status,
        nextStatus
      }));
    });
    return { track: { id: track.id, status: nextStatus } };
  }

  fastify.post('/tracks/:id/hide', mutate, (request, reply) =>
    setTrackStatus(request, reply, 'HIDDEN', 'TRACK_HIDE', ['PUBLISHED']));
  fastify.post('/tracks/:id/unhide', mutate, (request, reply) =>
    setTrackStatus(request, reply, 'PUBLISHED', 'TRACK_UNHIDE', ['HIDDEN']));
  fastify.post('/tracks/:id/reject', mutate, (request, reply) =>
    setTrackStatus(request, reply, 'REJECTED', 'TRACK_REJECT', ['PUBLISHED', 'PENDING_REVIEW', 'HIDDEN']));
  fastify.post('/tracks/:id/restore', mutate, (request, reply) =>
    setTrackStatus(request, reply, 'PENDING_REVIEW', 'TRACK_RESTORE', ['REJECTED']));

  fastify.post('/tracks/:id/lyrics/remove', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const track = await fastify.prisma.track.findUnique({ where: { id: request.params.id } });
    if (!track) return sendAdminError(reply, 404, 'ADMIN_TRACK_NOT_FOUND', 'Track not found.');
    const previousHasLyrics = hasLyrics(track);
    const lyricsUpdatedAt = new Date();
    await fastify.prisma.$transaction(async (tx) => {
      await tx.track.update({
        where: { id: track.id },
        data: {
          lyricsText: null,
          lyricsType: 'NONE',
          lyricsLanguage: null,
          lyricsSynced: null,
          lyricsRightsConfirmed: false,
          lyricsUpdatedAt
        }
      });
      await createAudit(tx, auditData(
        request.user.id,
        'TRACK_LYRICS_MODERATED',
        'TRACK',
        track.id,
        reason,
        { previousHasLyrics, hasLyrics: false, action: 'REMOVE' }
      ));
    });
    return {
      track: {
        id: track.id,
        hasLyrics: false,
        lyricsType: 'NONE',
        lyricsUpdatedAt
      }
    };
  });

  fastify.post('/tracks/:id/force-reprocess', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const track = await fastify.prisma.track.findUnique({
      where: { id: request.params.id },
      include: { uploads: { orderBy: { updatedAt: 'desc' }, take: 1 } }
    });
    if (!track) return sendAdminError(reply, 404, 'ADMIN_TRACK_NOT_FOUND', 'Track not found.');
    if (!['FAILED', 'REJECTED'].includes(track.status)) {
      return sendAdminError(reply, 409, 'ADMIN_REPROCESS_UNSAFE', 'Only failed or rejected tracks can be reprocessed.');
    }
    const upload = track.uploads[0];
    if (!upload || !['FAILED', 'READY'].includes(upload.status)) {
      return sendAdminError(reply, 409, 'ADMIN_REPROCESS_UNSAFE', 'No safe upload source is available for reprocessing.');
    }
    try {
      const jobId = await enqueueUpload(fastify, upload, request.user.id, reason, 'TRACK_FORCE_REPROCESS');
      return { track: { id: track.id, status: 'PROCESSING' }, uploadId: upload.id, jobId };
    } catch (error) {
      if (error.code === 'ADMIN_UPLOAD_OBJECT_MISSING') {
        return sendAdminError(reply, 409, error.code, error.message);
      }
      throw error;
    }
  });

  // --- Uploads -------------------------------------------------------------

  fastify.get('/uploads', read, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const search = sanitizeSearch(request.query.search);
    const status = enumFilter(request.query.status, UPLOAD_STATUSES);
    if (request.query.status && status === undefined) return invalidFilter(reply, 'status');
    const where = {
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { originalFileName: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { track: { title: { contains: search, mode: 'insensitive' } } }
        ]
      } : {})
    };
    const [total, uploads] = await fastify.prisma.$transaction([
      fastify.prisma.upload.count({ where }),
      fastify.prisma.upload.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, displayName: true, email: true } },
          track: { select: { id: true, title: true, status: true } }
        }
      })
    ]);
    return {
      data: uploads.map(publicUpload),
      pagination: paginationMeta(total, page, pageSize)
    };
  });

  fastify.get('/uploads/:id', read, async (request, reply) => {
    const upload = await fastify.prisma.upload.findUnique({
      where: { id: request.params.id },
      include: {
        user: { select: { id: true, username: true, displayName: true, email: true, status: true } },
        track: {
          select: {
            id: true,
            title: true,
            status: true,
            artist: { select: { id: true, user: { select: { id: true, username: true, displayName: true } } } }
          }
        }
      }
    });
    if (!upload) return sendAdminError(reply, 404, 'ADMIN_UPLOAD_NOT_FOUND', 'Upload not found.');
    const audit = await fastify.prisma.auditLog.findMany({
      where: { targetType: 'UPLOAD', targetId: upload.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { id: true, username: true, displayName: true } } }
    });
    let worker = { status: 'unavailable' };
    if (typeof fastify.audioQueue?.getJob === 'function') {
      try {
        const job = await fastify.audioQueue.getJob(`upload-${upload.id}`);
        worker = job ? { status: await job.getState(), attemptsMade: job.attemptsMade } : { status: 'not-found' };
      } catch {
        worker = { status: 'error' };
      }
    }
    return { upload: publicUpload(upload), worker, audit: audit.map(publicAudit) };
  });

  fastify.post('/uploads/:id/retry', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const upload = await fastify.prisma.upload.findUnique({ where: { id: request.params.id } });
    if (!upload) return sendAdminError(reply, 404, 'ADMIN_UPLOAD_NOT_FOUND', 'Upload not found.');
    if (upload.status !== 'FAILED') {
      return sendAdminError(reply, 409, 'ADMIN_INVALID_STATE', 'Only failed uploads can be retried.');
    }
    try {
      const jobId = await enqueueUpload(fastify, upload, request.user.id, reason, 'UPLOAD_RETRY');
      return { upload: { id: upload.id, status: 'PROCESSING' }, jobId };
    } catch (error) {
      if (error.code === 'ADMIN_UPLOAD_OBJECT_MISSING') {
        return sendAdminError(reply, 409, error.code, error.message);
      }
      throw error;
    }
  });

  fastify.post('/uploads/:id/cancel', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const upload = await fastify.prisma.upload.findUnique({ where: { id: request.params.id } });
    if (!upload) return sendAdminError(reply, 404, 'ADMIN_UPLOAD_NOT_FOUND', 'Upload not found.');
    if (!['INITIATED', 'UPLOADING', 'FAILED'].includes(upload.status)) {
      return sendAdminError(reply, 409, 'ADMIN_CANCEL_UNSAFE', 'An active or completed processing job cannot be cancelled safely.');
    }
    await fastify.prisma.$transaction(async (tx) => {
      await tx.upload.update({ where: { id: upload.id }, data: { status: 'CANCELLED' } });
      if (upload.trackId) {
        await tx.track.updateMany({
          where: { id: upload.trackId, status: { in: ['DRAFT', 'FAILED'] } },
          data: { status: 'REJECTED' }
        });
      }
      await createAudit(tx, auditData(request.user.id, 'UPLOAD_CANCEL', 'UPLOAD', upload.id, reason, {
        previousStatus: upload.status,
        trackId: upload.trackId || null
      }));
    });
    return { upload: { id: upload.id, status: 'CANCELLED' } };
  });

  // --- Artists -------------------------------------------------------------

  fastify.get('/artists', read, async (request) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const search = sanitizeSearch(request.query.search);
    const hidden = request.query.hidden === 'true'
      ? true
      : request.query.hidden === 'false' ? false : undefined;
    const where = {
      ...(hidden === undefined ? {} : { isHidden: hidden }),
      ...(search ? {
        user: {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }
      } : {})
    };
    const [total, artists] = await fastify.prisma.$transaction([
      fastify.prisma.artistProfile.count({ where }),
      fastify.prisma.artistProfile.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          isHidden: true,
          genres: true,
          monthlyListeners: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, username: true, displayName: true, email: true, avatarUrl: true, status: true } },
          _count: { select: { tracks: true, followers: true } }
        }
      })
    ]);
    return { data: artists, pagination: paginationMeta(total, page, pageSize) };
  });

  fastify.get('/artists/:id', read, async (request, reply) => {
    const artist = await fastify.prisma.artistProfile.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        isHidden: true,
        genres: true,
        socialLinks: true,
        monthlyListeners: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            bio: true,
            status: true,
            role: true
          }
        },
        tracks: {
          orderBy: { updatedAt: 'desc' },
          take: 100,
          select: { id: true, title: true, status: true, plays: true, updatedAt: true }
        },
        _count: { select: { tracks: true, followers: true } }
      }
    });
    if (!artist) return sendAdminError(reply, 404, 'ADMIN_ARTIST_NOT_FOUND', 'Artist not found.');
    const [reports, audit] = await Promise.all([
      fastify.prisma.report.findMany({
        where: { targetType: 'ARTIST', targetId: artist.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { reporter: { select: { id: true, username: true, displayName: true } } }
      }),
      fastify.prisma.auditLog.findMany({
        where: { targetType: 'ARTIST', targetId: artist.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actor: { select: { id: true, username: true, displayName: true } } }
      })
    ]);
    return { artist, reports, audit: audit.map(publicAudit) };
  });

  async function setArtistHidden(request, reply, isHidden) {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const artist = await fastify.prisma.artistProfile.findUnique({ where: { id: request.params.id } });
    if (!artist) return sendAdminError(reply, 404, 'ADMIN_ARTIST_NOT_FOUND', 'Artist not found.');
    if (artist.isHidden === isHidden) {
      return sendAdminError(reply, 409, 'ADMIN_INVALID_STATE', isHidden ? 'Artist is already hidden.' : 'Artist is not hidden.');
    }
    await fastify.prisma.$transaction(async (tx) => {
      await tx.artistProfile.update({ where: { id: artist.id }, data: { isHidden } });
      await createAudit(tx, auditData(
        request.user.id,
        isHidden ? 'ARTIST_HIDE' : 'ARTIST_UNHIDE',
        'ARTIST',
        artist.id,
        reason
      ));
    });
    return { artist: { id: artist.id, isHidden } };
  }
  fastify.post('/artists/:id/hide', mutate, (request, reply) => setArtistHidden(request, reply, true));
  fastify.post('/artists/:id/unhide', mutate, (request, reply) => setArtistHidden(request, reply, false));

  // --- Comments ------------------------------------------------------------

  fastify.get('/comments', read, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const search = sanitizeSearch(request.query.search);
    const visibility = request.query.status
      ? String(request.query.status).toUpperCase()
      : null;
    if (visibility && !['VISIBLE', 'HIDDEN'].includes(visibility)) return invalidFilter(reply, 'status');
    const where = {
      ...(visibility ? { isDeleted: visibility === 'HIDDEN' } : {}),
      ...(search ? {
        OR: [
          { text: { contains: search, mode: 'insensitive' } },
          { user: { username: { contains: search, mode: 'insensitive' } } },
          { track: { title: { contains: search, mode: 'insensitive' } } }
        ]
      } : {})
    };
    const [total, comments] = await fastify.prisma.$transaction([
      fastify.prisma.comment.count({ where }),
      fastify.prisma.comment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          ...COMMENT_SELECT,
          user: { select: { id: true, username: true, displayName: true, status: true } },
          track: { select: { id: true, title: true, status: true } },
          _count: { select: { replies: true } }
        }
      })
    ]);
    const ids = comments.map((comment) => comment.id);
    const reports = ids.length
      ? await fastify.prisma.report.groupBy({
        by: ['targetId'],
        where: { targetType: 'COMMENT', targetId: { in: ids } },
        _count: { _all: true }
      })
      : [];
    const counts = new Map(reports.map((row) => [row.targetId, row._count._all]));
    return {
      data: comments.map((comment) => ({
        ...comment,
        repliesCount: comment._count.replies,
        reportsCount: counts.get(comment.id) || 0,
        _count: undefined
      })),
      pagination: paginationMeta(total, page, pageSize)
    };
  });

  fastify.get('/comments/:id', read, async (request, reply) => {
    const comment = await fastify.prisma.comment.findUnique({
      where: { id: request.params.id },
      select: {
        ...COMMENT_SELECT,
        user: { select: { id: true, username: true, displayName: true, email: true, status: true } },
        track: { select: { id: true, title: true, status: true } },
        replies: {
          take: 100,
          orderBy: { createdAt: 'asc' },
          select: {
            ...COMMENT_SELECT,
            user: { select: { id: true, username: true, displayName: true, status: true } }
          }
        }
      }
    });
    if (!comment) return sendAdminError(reply, 404, 'ADMIN_COMMENT_NOT_FOUND', 'Comment not found.');
    const [reports, audit] = await Promise.all([
      fastify.prisma.report.findMany({
        where: { targetType: 'COMMENT', targetId: comment.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { reporter: { select: { id: true, username: true, displayName: true } } }
      }),
      fastify.prisma.auditLog.findMany({
        where: { targetType: 'COMMENT', targetId: comment.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actor: { select: { id: true, username: true, displayName: true } } }
      })
    ]);
    return { comment, reports, audit: audit.map(publicAudit) };
  });

  async function setCommentHidden(request, reply, hidden) {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const comment = await fastify.prisma.comment.findUnique({ where: { id: request.params.id } });
    if (!comment) return sendAdminError(reply, 404, 'ADMIN_COMMENT_NOT_FOUND', 'Comment not found.');
    if (comment.isDeleted === hidden) {
      return sendAdminError(reply, 409, 'ADMIN_INVALID_STATE', hidden ? 'Comment is already hidden.' : 'Comment is not hidden.');
    }
    let originalText = null;
    if (!hidden) {
      const hideAudit = await fastify.prisma.auditLog.findFirst({
        where: { action: 'COMMENT_HIDE', targetType: 'COMMENT', targetId: comment.id },
        orderBy: { createdAt: 'desc' }
      });
      originalText = hideAudit?.metadata?.originalText;
      if (typeof originalText !== 'string' || !originalText) {
        return sendAdminError(reply, 409, 'ADMIN_RESTORE_UNSAFE', 'Original comment text is unavailable.');
      }
    }
    await fastify.prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: comment.id },
        data: hidden
          ? { isDeleted: true, text: '[Removed by moderator]' }
          : { isDeleted: false, text: originalText }
      });
      await createAudit(tx, auditData(
        request.user.id,
        hidden ? 'COMMENT_HIDE' : 'COMMENT_UNHIDE',
        'COMMENT',
        comment.id,
        reason,
        hidden ? { originalText: comment.text } : null
      ));
    });
    return { comment: { id: comment.id, isDeleted: hidden } };
  }
  fastify.post('/comments/:id/hide', mutate, (request, reply) => setCommentHidden(request, reply, true));
  fastify.post('/comments/:id/unhide', mutate, (request, reply) => setCommentHidden(request, reply, false));

  // --- Reports -------------------------------------------------------------

  fastify.get('/reports', read, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const status = enumFilter(request.query.status, REPORT_STATUSES);
    const targetType = enumFilter(request.query.targetType, REPORT_TARGET_TYPES);
    const reason = sanitizeSearch(request.query.reason, 40).toUpperCase();
    if (request.query.status && status === undefined) return invalidFilter(reply, 'status');
    if (request.query.targetType && targetType === undefined) return invalidFilter(reply, 'target type');
    const where = {
      ...(status ? { status } : {}),
      ...(targetType ? { targetType } : {}),
      ...(reason ? { reason } : {})
    };
    const [total, reports] = await fastify.prisma.$transaction([
      fastify.prisma.report.count({ where }),
      fastify.prisma.report.findMany({
        where,
        skip,
        take,
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' }
        ],
        include: {
          reporter: { select: { id: true, username: true, displayName: true, status: true } },
          decision: true
        }
      })
    ]);
    return { data: reports, pagination: paginationMeta(total, page, pageSize) };
  });

  fastify.get('/reports/:id', read, async (request, reply) => {
    const report = await fastify.prisma.report.findUnique({
      where: { id: request.params.id },
      include: {
        reporter: { select: { id: true, username: true, displayName: true, email: true, status: true } },
        decision: true
      }
    });
    if (!report) return sendAdminError(reply, 404, 'ADMIN_REPORT_NOT_FOUND', 'Report not found.');
    const [target, audit] = await Promise.all([
      reportTargetContext(fastify.prisma, report),
      fastify.prisma.auditLog.findMany({
        where: { targetType: 'REPORT', targetId: report.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actor: { select: { id: true, username: true, displayName: true } } }
      })
    ]);
    return { report, target, audit: audit.map(publicAudit) };
  });

  async function decideReport(request, reply, status, auditAction) {
    const notes = typeof request.body?.notes === 'string'
      ? request.body.notes.trim().slice(0, 2000)
      : requiredReason(request.body, 2000);
    if (!notes) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'Moderation notes are required.');
    const report = await fastify.prisma.report.findUnique({ where: { id: request.params.id } });
    if (!report) return sendAdminError(reply, 404, 'ADMIN_REPORT_NOT_FOUND', 'Report not found.');
    if (!['OPEN', 'ESCALATED'].includes(report.status)) {
      return sendAdminError(reply, 409, 'ADMIN_INVALID_STATE', 'This report has already been decided.');
    }
    const targetAction = request.body?.targetAction || 'NONE';
    if (!['NONE', 'HIDE_TARGET', 'SUSPEND_USER'].includes(targetAction)) {
      return sendAdminError(reply, 400, 'ADMIN_INVALID_INPUT', 'Invalid target action.');
    }

    await fastify.prisma.$transaction(async (tx) => {
      if (targetAction === 'HIDE_TARGET') {
        if (report.targetType === 'TRACK') {
          const track = await tx.track.findUnique({ where: { id: report.targetId } });
          if (!track || track.status !== 'PUBLISHED') throw Object.assign(new Error('Target track cannot be hidden.'), { safeCode: 'ADMIN_TARGET_ACTION_INVALID' });
          await tx.track.update({ where: { id: track.id }, data: { status: 'HIDDEN' } });
          await createAudit(tx, auditData(request.user.id, 'TRACK_HIDE', 'TRACK', track.id, notes, { reportId: report.id }));
        } else if (report.targetType === 'COMMENT') {
          const comment = await tx.comment.findUnique({ where: { id: report.targetId } });
          if (!comment || comment.isDeleted) throw Object.assign(new Error('Target comment cannot be hidden.'), { safeCode: 'ADMIN_TARGET_ACTION_INVALID' });
          await tx.comment.update({
            where: { id: comment.id },
            data: { isDeleted: true, text: '[Removed by moderator]' }
          });
          await createAudit(tx, auditData(request.user.id, 'COMMENT_HIDE', 'COMMENT', comment.id, notes, {
            reportId: report.id,
            originalText: comment.text
          }));
        } else if (report.targetType === 'ARTIST') {
          const artist = await tx.artistProfile.findUnique({ where: { id: report.targetId } });
          if (!artist || artist.isHidden) throw Object.assign(new Error('Target artist cannot be hidden.'), { safeCode: 'ADMIN_TARGET_ACTION_INVALID' });
          await tx.artistProfile.update({ where: { id: artist.id }, data: { isHidden: true } });
          await createAudit(tx, auditData(request.user.id, 'ARTIST_HIDE', 'ARTIST', artist.id, notes, { reportId: report.id }));
        } else {
          throw Object.assign(new Error('This target type cannot be hidden.'), { safeCode: 'ADMIN_TARGET_ACTION_INVALID' });
        }
      }
      if (targetAction === 'SUSPEND_USER') {
        let userId = null;
        if (report.targetType === 'USER') userId = report.targetId;
        if (report.targetType === 'TRACK') {
          const track = await tx.track.findUnique({
            where: { id: report.targetId },
            select: { artist: { select: { userId: true } } }
          });
          userId = track?.artist?.userId || null;
        }
        if (report.targetType === 'COMMENT') {
          const comment = await tx.comment.findUnique({ where: { id: report.targetId }, select: { userId: true } });
          userId = comment?.userId || null;
        }
        if (report.targetType === 'ARTIST') {
          const artist = await tx.artistProfile.findUnique({ where: { id: report.targetId }, select: { userId: true } });
          userId = artist?.userId || null;
        }
        const user = userId ? await tx.user.findUnique({ where: { id: userId } }) : null;
        if (!user || user.role === 'ADMIN' || user.id === request.user.id || user.status !== 'ACTIVE') {
          throw Object.assign(new Error('The target user cannot be suspended.'), { safeCode: 'ADMIN_TARGET_ACTION_INVALID' });
        }
        await tx.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await createAudit(tx, auditData(request.user.id, 'USER_SUSPEND', 'USER', user.id, notes, { reportId: report.id }));
      }

      await tx.report.update({
        where: { id: report.id },
        data: { status, reviewedAt: new Date(), reviewedById: request.user.id }
      });
      await tx.moderationDecision.upsert({
        where: { reportId: report.id },
        update: { adminId: request.user.id, actionTaken: targetAction === 'NONE' ? status : targetAction, notes },
        create: {
          reportId: report.id,
          adminId: request.user.id,
          actionTaken: targetAction === 'NONE' ? status : targetAction,
          notes
        }
      });
      await createAudit(tx, auditData(request.user.id, auditAction, 'REPORT', report.id, notes, {
        previousStatus: report.status,
        nextStatus: status,
        targetAction
      }));
    });
    return { report: { id: report.id, status }, targetAction };
  }

  fastify.post('/reports/:id/resolve', mutate, (request, reply) => {
    const legacyAction = request.body?.action;
    const status = legacyAction && ['REVIEWED', 'ACTION_TAKEN'].includes(legacyAction)
      ? legacyAction
      : (request.body?.targetAction && request.body.targetAction !== 'NONE' ? 'ACTION_TAKEN' : 'REVIEWED');
    return decideReport(request, reply, status, 'REPORT_RESOLVE');
  });
  fastify.post('/reports/:id/reject', mutate, (request, reply) =>
    decideReport(request, reply, 'DISMISSED', 'REPORT_REJECT'));
  fastify.post('/reports/:id/escalate', mutate, async (request, reply) => {
    const notes = typeof request.body?.notes === 'string'
      ? request.body.notes.trim().slice(0, 2000)
      : requiredReason(request.body, 2000);
    if (!notes) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'Moderation notes are required.');
    const report = await fastify.prisma.report.findUnique({ where: { id: request.params.id } });
    if (!report) return sendAdminError(reply, 404, 'ADMIN_REPORT_NOT_FOUND', 'Report not found.');
    if (report.status !== 'OPEN') {
      return sendAdminError(reply, 409, 'ADMIN_INVALID_STATE', 'Only open reports can be escalated.');
    }
    await fastify.prisma.$transaction(async (tx) => {
      await tx.report.update({ where: { id: report.id }, data: { status: 'ESCALATED' } });
      await createAudit(tx, auditData(request.user.id, 'REPORT_ESCALATE', 'REPORT', report.id, notes));
    });
    return { report: { id: report.id, status: 'ESCALATED' } };
  });

  // --- Audit logs ----------------------------------------------------------

  fastify.get('/audit-logs', read, async (request) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const actor = sanitizeSearch(request.query.actor);
    const action = sanitizeSearch(request.query.action, 80).toUpperCase();
    const targetType = sanitizeSearch(request.query.targetType, 40).toUpperCase();
    const targetId = sanitizeSearch(request.query.targetId);
    const from = request.query.from && !Number.isNaN(Date.parse(request.query.from))
      ? new Date(request.query.from)
      : null;
    const to = request.query.to && !Number.isNaN(Date.parse(request.query.to))
      ? new Date(request.query.to)
      : null;
    const where = {
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId: { contains: targetId, mode: 'insensitive' } } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(actor ? {
        actor: {
          OR: [
            { id: { contains: actor, mode: 'insensitive' } },
            { username: { contains: actor, mode: 'insensitive' } },
            { displayName: { contains: actor, mode: 'insensitive' } }
          ]
        }
      } : {})
    };
    const [total, logs] = await fastify.prisma.$transaction([
      fastify.prisma.auditLog.count({ where }),
      fastify.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, username: true, displayName: true } } }
      })
    ]);
    return { data: logs.map(publicAudit), pagination: paginationMeta(total, page, pageSize) };
  });

  fastify.get('/audit-logs/:id', read, async (request, reply) => {
    const log = await fastify.prisma.auditLog.findUnique({
      where: { id: request.params.id },
      include: { actor: { select: { id: true, username: true, displayName: true } } }
    });
    if (!log) return sendAdminError(reply, 404, 'ADMIN_AUDIT_NOT_FOUND', 'Audit entry not found.');
    return { auditLog: publicAudit(log) };
  });

  // --- System --------------------------------------------------------------

  fastify.get('/system', read, async () => {
    const system = await systemChecks(fastify);
    const commit = process.env.APP_COMMIT_SHA || process.env.GIT_COMMIT || null;
    return {
      readiness: {
        status: system.ready ? 'ready' : 'not-ready',
        checks: system.checks
      },
      queue: system.queue,
      version: backendPackage.version,
      commit: commit && /^[a-f0-9]{7,64}$/i.test(commit) ? commit.slice(0, 12) : null,
      uptimeSeconds: Math.floor(process.uptime()),
      config: {
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'non-production',
        database: process.env.DATABASE_URL ? 'configured' : 'missing',
        redis: process.env.REDIS_URL || process.env.REDIS_HOST ? 'configured' : 'missing',
        storage: process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? 'configured'
          : 'missing',
        googleOAuth: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
          ? 'configured'
          : 'disabled',
        secrets: 'redacted'
      },
      backup: { status: 'unavailable' }
    };
  });

  // --- Stats integrity -------------------------------------------------

  // GET /admin/stats/integrity — read-only, safe to call as often as
  // desired. Runs the exact same checks as `npm run stats:check` (see
  // backend/src/lib/statsIntegrity.js), so the admin UI and the CLI can
  // never disagree.
  fastify.get('/stats/integrity', read, async () => {
    const report = await runStatsIntegrityCheck(fastify.prisma);
    return report;
  });

  // POST /admin/stats/recalculate — admin-only, audited, CSRF-protected
  // (global CSRF hook) and rate-limited (adminMutationOptions). Body:
  // { reason, target?: 'monthlyListeners' | 'trackPlays' | 'all' }.
  // Recomputes (never increments) the requested stored aggregate(s) from
  // the real PlayEvent rows, so it is always safe to run repeatedly.
  fastify.post('/stats/recalculate', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const target = ['monthlyListeners', 'trackPlays', 'all'].includes(request.body?.target)
      ? request.body.target
      : 'all';

    const summary = { target, monthlyListeners: null, trackPlays: null };
    if (target === 'monthlyListeners' || target === 'all') {
      const results = await recalculateAllArtistMonthlyListeners(fastify.prisma);
      summary.monthlyListeners = {
        artistsChecked: results.length,
        artistsChanged: results.filter((result) => result.changed).length
      };
    }
    if (target === 'trackPlays' || target === 'all') {
      const results = await recalculateAllTrackPlayCounts(fastify.prisma);
      summary.trackPlays = {
        tracksChecked: results.length,
        tracksChanged: results.filter((result) => result.changed).length
      };
    }

    await createAudit(fastify.prisma, auditData(
      request.user.id,
      'STATS_RECALCULATE',
      'SYSTEM',
      'stats',
      reason,
      { requestId: request.id, ...summary }
    ));

    return { success: true, ...summary };
  });

  // POST /admin/stats/artists/:id/recalculate — same recomputation, scoped
  // to a single artist (used by the per-artist "recalculate" affordance
  // rather than forcing a full-catalog recalculation for a one-off fix).
  fastify.post('/stats/artists/:id/recalculate', mutate, async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');

    const result = await recalculateArtistMonthlyListeners(fastify.prisma, request.params.id);
    if (!result) return sendAdminError(reply, 404, 'ADMIN_ARTIST_NOT_FOUND', 'Artist profile not found.');

    await createAudit(fastify.prisma, auditData(
      request.user.id,
      'STATS_RECALCULATE',
      'ARTIST',
      request.params.id,
      reason,
      { requestId: request.id, ...result }
    ));

    return { success: true, ...result };
  });
}

module.exports = adminRoutes;
