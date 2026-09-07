'use strict';

const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const backendPackage = require('../../package.json');
const {
  ADMIN_PERMISSIONS,
  adminReadOptions,
  adminMutationOptions,
  hasAdminPermission,
  sendAdminError,
  requiredReason
} = require('../lib/adminGuard');
const {
  parsePagination,
  paginationMeta,
  sanitizeSearch,
  enumFilter
} = require('../lib/pagination');
const { auditData, auditRequestContext, createAudit } = require('../lib/auditLog');
const {
  AdminAuditQueryError,
  auditLogsCsv,
  buildAuditWhere,
  parseAuditExportQuery,
  parseAuditListQuery,
  publicAuditRecord
} = require('../lib/adminAudit');
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
const { serializeUserMedia } = require('../lib/profileMedia');
const { parseTrackContentType } = require('../lib/trackContentType');
const { validateBeatMetadata } = require('../lib/beatMetadata');
const {
  formatCreatorsCsv,
  CREATOR_TYPES,
  CREATOR_STATUSES,
  MAX_ADMIN_NOTE_LENGTH
} = require('../lib/creators');

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

function adminAuditData(request, actorId, action, targetType, targetId, reason, metadata, result = 'SUCCESS') {
  return auditData(
    actorId,
    action,
    targetType,
    targetId,
    reason,
    metadata,
    auditRequestContext(request, { result })
  );
}

function auditQueryError(reply, error) {
  if (!(error instanceof AdminAuditQueryError)) throw error;
  return sendAdminError(reply, 400, 'ADMIN_INVALID_FILTER', error.message, { field: error.field });
}

function canReadPii(request) {
  return hasAdminPermission(request.user?.role, ADMIN_PERMISSIONS.PII_READ);
}

function auditActorSelect(includePii = false) {
  return {
    id: true,
    ...(includePii ? { email: true } : {}),
    username: true,
    displayName: true,
    role: true
  };
}

function adminArtistAccessUserSelect(includePii = false) {
  const { email, ...withoutPii } = ARTIST_ACCESS_USER_SELECT;
  return includePii ? { ...withoutPii, email } : withoutPii;
}

function parseAdminSearchQuery(query = {}) {
  const allowed = new Set(['q', 'limit']);
  const unsupported = Object.keys(query).find((key) => !allowed.has(key));
  if (unsupported) {
    const error = new Error(`Unsupported search parameter: ${unsupported}.`);
    error.field = unsupported;
    throw error;
  }
  if (typeof query.q !== 'string') {
    const error = new Error('q must be a string.');
    error.field = 'q';
    throw error;
  }
  const q = query.q.trim();
  if (q.length < 2 || q.length > 120 || /\p{Cc}/u.test(q)) {
    const error = new Error('q must contain 2-120 printable characters.');
    error.field = 'q';
    throw error;
  }
  const rawLimit = query.limit === undefined ? '5' : query.limit;
  if (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit)) {
    const error = new Error('limit must be an integer from 1 to 10.');
    error.field = 'limit';
    throw error;
  }
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10) {
    const error = new Error('limit must be an integer from 1 to 10.');
    error.field = 'limit';
    throw error;
  }
  return { q, limit };
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

async function enqueueUpload(fastify, upload, request, reason, action) {
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
    await createAudit(tx, adminAuditData(request, request.user.id, action, 'UPLOAD', upload.id, reason, {
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
  const read = (permission) => adminReadOptions(fastify, permission);
  const mutate = (permission) => adminMutationOptions(fastify, permission);

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

  fastify.get('/overview', read(ADMIN_PERMISSIONS.OVERVIEW_READ), async () => {
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
  fastify.get('/summary', read(ADMIN_PERMISSIONS.OVERVIEW_READ), async (request, reply) => {
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

  fastify.get('/search', read(ADMIN_PERMISSIONS.SEARCH_READ), async (request, reply) => {
    let parsed;
    try {
      parsed = parseAdminSearchQuery(request.query);
    } catch (error) {
      return sendAdminError(reply, 400, 'ADMIN_INVALID_SEARCH', error.message, { field: error.field });
    }
    const { q, limit } = parsed;
    const includePii = canReadPii(request);
    const [users, tracks, artists, reports, uploads, auditEvents] = await Promise.all([
      fastify.prisma.user.findMany({
        where: {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            ...(includePii ? [{ email: { contains: q, mode: 'insensitive' } }] : []),
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          ...(includePii ? { email: true } : {}),
          username: true,
          displayName: true,
          status: true
        }
      }),
      fastify.prisma.track.findMany({
        where: {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { genre: { contains: q, mode: 'insensitive' } },
            { artist: { user: { displayName: { contains: q, mode: 'insensitive' } } } },
            { artist: { user: { username: { contains: q, mode: 'insensitive' } } } }
          ]
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          artist: { select: { user: { select: { username: true, displayName: true } } } }
        }
      }),
      fastify.prisma.artistProfile.findMany({
        where: {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            {
              user: {
                OR: [
                  ...(includePii ? [{ email: { contains: q, mode: 'insensitive' } }] : []),
                  { username: { contains: q, mode: 'insensitive' } },
                  { displayName: { contains: q, mode: 'insensitive' } }
                ]
              }
            }
          ]
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          isHidden: true,
          user: {
            select: {
              ...(includePii ? { email: true } : {}),
              username: true,
              displayName: true,
              status: true
            }
          }
        }
      }),
      fastify.prisma.report.findMany({
        where: {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            { reason: { contains: q, mode: 'insensitive' } },
            { targetType: { contains: q, mode: 'insensitive' } },
            { targetId: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, reason: true, targetType: true, targetId: true, status: true }
      }),
      fastify.prisma.upload.findMany({
        where: {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            { originalFileName: { contains: q, mode: 'insensitive' } },
            ...(includePii ? [{ user: { email: { contains: q, mode: 'insensitive' } } }] : []),
            { user: { username: { contains: q, mode: 'insensitive' } } },
            { track: { title: { contains: q, mode: 'insensitive' } } }
          ]
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          originalFileName: true,
          status: true,
          user: { select: { username: true, displayName: true } },
          track: { select: { title: true } }
        }
      }),
      fastify.prisma.auditLog.findMany({
        where: {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            { action: { contains: q, mode: 'insensitive' } },
            { targetType: { contains: q, mode: 'insensitive' } },
            { targetId: { contains: q, mode: 'insensitive' } },
            { reason: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: auditActorSelect() } }
      })
    ]);

    const groups = [
      {
        type: 'users',
        items: users.map((user) => ({
          id: user.id,
          title: user.displayName || user.username || (includePii ? user.email : null) || user.id,
          subtitle: user.username
            ? `@${user.username}${includePii && user.email ? ` · ${user.email}` : ''}`
            : ((includePii && user.email) || user.id),
          status: user.status,
          to: `/admin/users/${encodeURIComponent(user.id)}`
        }))
      },
      {
        type: 'tracks',
        items: tracks.map((track) => ({
          id: track.id,
          title: track.title,
          subtitle: track.artist.user.displayName || `@${track.artist.user.username}`,
          status: track.status,
          to: `/admin/tracks/${encodeURIComponent(track.id)}`
        }))
      },
      {
        type: 'artists',
        items: artists.map((artist) => ({
          id: artist.id,
          title: artist.user.displayName || artist.user.username ||
            (includePii ? artist.user.email : null) || artist.id,
          subtitle: artist.user.username
            ? `@${artist.user.username}`
            : ((includePii && artist.user.email) || artist.id),
          status: artist.isHidden ? 'HIDDEN' : artist.user.status,
          to: `/admin/artists/${encodeURIComponent(artist.id)}`
        }))
      },
      {
        type: 'reports',
        items: reports.map((report) => ({
          id: report.id,
          title: report.reason,
          subtitle: `${report.targetType} · ${report.targetId}`,
          status: report.status,
          to: `/admin/reports/${encodeURIComponent(report.id)}`
        }))
      },
      {
        type: 'uploads',
        items: uploads.map((upload) => ({
          id: upload.id,
          title: upload.originalFileName,
          subtitle: upload.track?.title || upload.user.displayName || `@${upload.user.username}`,
          status: upload.status,
          to: `/admin/uploads?search=${encodeURIComponent(upload.id)}`
        }))
      },
      {
        type: 'auditEvents',
        items: auditEvents.map((event) => {
          const safeEvent = publicAuditRecord(event);
          return {
            id: event.id,
            title: event.action,
            subtitle: `${event.targetType} · ${event.targetId}`,
            status: safeEvent.result || 'SUCCESS',
            to: `/admin/audit-logs?event=${encodeURIComponent(event.id)}`
          };
        })
      }
    ].filter((group) => group.items.length > 0);

    return {
      query: q,
      limitPerGroup: limit,
      totalResults: groups.reduce((sum, group) => sum + group.items.length, 0),
      groups
    };
  });

  // --- Users ---------------------------------------------------------------

  fastify.get('/users', read(ADMIN_PERMISSIONS.USERS_READ), async (request, reply) => {
    const includePii = canReadPii(request);
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

    const allowedSort = ['updatedAt', 'id', 'joinedAt', ...(includePii ? ['email'] : [])];
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
          ...(includePii ? [{ email: { contains: search, mode: 'insensitive' } }] : []),
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
          ...(includePii ? { email: true } : {}),
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

  fastify.get('/users/:id', read(ADMIN_PERMISSIONS.USERS_READ), async (request, reply) => {
    const includePii = canReadPii(request);
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        ...(includePii ? { email: true } : {}),
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
        include: { actor: { select: auditActorSelect() } }
      })
    ]);
    const serializedUser = await serializeUserMedia(fastify.storage, user);
    return {
      user: {
        ...serializedUser,
        sessions: { active: user._count.sessions },
        counts: user._count,
        ...summarizeArtistAccess(user),
        _count: undefined
      },
      reportsAgainst,
      audit: audit.map(publicAuditRecord)
    };
  });

  fastify.patch('/users/:id', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), async (request, reply) => {
    const body = request.body || {};
    const reason = requiredReason(body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: { id: true }
    });
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
        select: {
          id: true,
          ...(canReadPii(request) ? { email: true } : {}),
          username: true,
          displayName: true,
          role: true,
          status: true,
          updatedAt: true
        }
      });
      await createAudit(tx, adminAuditData(request, request.user.id, 'USER_UPDATE', 'USER', target.id, reason, {
        fields: Object.keys(data)
      }));
      return changed;
    });
    return { user: updated };
  });

  async function changeUserStatus(request, reply, nextStatus, action, allowedCurrent) {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: { id: true, role: true, status: true }
    });
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
      await tx.user.update({
        where: { id: target.id },
        data: { status: nextStatus },
        select: { id: true }
      });
      if (['SUSPENDED', 'BANNED'].includes(nextStatus)) {
        await tx.session.deleteMany({ where: { userId: target.id } });
      }
      await createAudit(tx, adminAuditData(request, request.user.id, action, 'USER', target.id, reason, {
        previousStatus: target.status,
        nextStatus
      }));
    });
    return { user: { id: target.id, status: nextStatus } };
  }

  fastify.post('/users/:id/suspend', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), (request, reply) =>
    changeUserStatus(request, reply, 'SUSPENDED', 'USER_SUSPEND', ['ACTIVE']));
  fastify.post('/users/:id/unsuspend', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), (request, reply) =>
    changeUserStatus(request, reply, 'ACTIVE', 'USER_UNSUSPEND', ['SUSPENDED']));
  fastify.post('/users/:id/ban', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), (request, reply) =>
    changeUserStatus(request, reply, 'BANNED', 'USER_BAN', ['ACTIVE', 'SUSPENDED']));
  fastify.post('/users/:id/unban', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), (request, reply) =>
    changeUserStatus(request, reply, 'ACTIVE', 'USER_UNBAN', ['BANNED']));

  fastify.post('/users/:id/revoke-sessions', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: { id: true }
    });
    if (!target) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    const revoked = await fastify.prisma.$transaction(async (tx) => {
      const result = await tx.session.deleteMany({ where: { userId: target.id } });
      await createAudit(tx, adminAuditData(request, request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
        revokedCount: result.count
      }));
      return result.count;
    });
    return { userId: target.id, revokedSessions: revoked };
  });

  fastify.post('/users/:id/set-role', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), async (request, reply) => {
    const role = enumFilter(request.body?.role, USER_ROLES);
    const reason = requiredReason(request.body);
    if (!role) return sendAdminError(reply, 400, 'ADMIN_INVALID_ROLE', 'A valid role is required.');
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    if (request.body?.confirmation !== 'SET_ROLE') {
      return sendAdminError(reply, 400, 'ADMIN_CONFIRMATION_REQUIRED', 'Role changes require explicit confirmation.');
    }
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        role: true,
        status: true,
        artistProfile: { select: { id: true, isHidden: true } }
      }
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
      await tx.user.update({
        where: { id: target.id },
        data: { role },
        select: { id: true }
      });
      await createAudit(tx, adminAuditData(request, request.user.id, 'USER_SET_ROLE', 'USER', target.id, reason, {
        previousRole: target.role,
        nextRole: role,
        requestId: request.id
      }));

      let profile = target.artistProfile;
      if (createArtistProfile && !profile) {
        const ensured = await ensureArtistProfile(tx, target.id);
        profile = ensured.profile;
        if (ensured.created) {
          await createAudit(tx, adminAuditData(request, request.user.id, 'ARTIST_PROFILE_CREATED', 'ARTIST', ensured.profile.id, reason, {
            userId: target.id,
            triggeredBy: 'USER_SET_ROLE'
          }));
        }
      } else if (hideArtistProfile && profile && !profile.isHidden) {
        profile = await tx.artistProfile.update({ where: { id: profile.id }, data: { isHidden: true } });
        await createAudit(tx, adminAuditData(request, request.user.id, 'ARTIST_HIDE', 'ARTIST', profile.id, reason, {
          userId: target.id,
          triggeredBy: 'USER_SET_ROLE'
        }));
      }

      if (revokeSessions) {
        const revoked = await tx.session.deleteMany({ where: { userId: target.id } });
        await createAudit(tx, adminAuditData(request, request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
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

  fastify.post('/users/:id/grant-artist', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    if (request.user.status !== 'ACTIVE') {
      return sendAdminError(reply, 403, 'ADMIN_NOT_ACTIVE', 'Your admin account is not active.');
    }
    const includePii = canReadPii(request);
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: adminArtistAccessUserSelect(includePii)
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
        await createAudit(tx, adminAuditData(request, request.user.id, 'USER_SET_ROLE', 'USER', target.id, reason, {
          previousRole: diff.previousRole,
          nextRole: diff.nextRole,
          triggeredBy: 'USER_GRANT_ARTIST'
        }));
      }
      if (diff.profileCreated) {
        await createAudit(tx, adminAuditData(request, request.user.id, 'ARTIST_PROFILE_CREATED', 'ARTIST', diff.profile.id, reason, {
          userId: target.id,
          triggeredBy: 'USER_GRANT_ARTIST'
        }));
      }
      if (diff.profileUnhiddenNow) {
        await createAudit(tx, adminAuditData(request, request.user.id, 'ARTIST_UNHIDE', 'ARTIST', diff.profile.id, reason, {
          userId: target.id,
          triggeredBy: 'USER_GRANT_ARTIST'
        }));
      }
      if (diff.sessionsRevoked) {
        await createAudit(tx, adminAuditData(request, request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
          revokedCount: diff.revokedSessionCount,
          triggeredBy: 'USER_GRANT_ARTIST'
        }));
      }
      await createAudit(tx, adminAuditData(request, request.user.id, 'USER_GRANT_ARTIST', 'USER', target.id, reason, {
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
        ...(includePii ? { email: target.email } : {}),
        username: target.username,
        displayName: target.displayName,
        role: outcome.nextRole,
        status: outcome.nextStatus,
        ...summarizeArtistAccess({ role: outcome.nextRole, status: outcome.nextStatus, artistProfile: outcome.profile })
      }
    };
  });

  fastify.post('/users/:id/revoke-artist', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    if (request.user.status !== 'ACTIVE') {
      return sendAdminError(reply, 403, 'ADMIN_NOT_ACTIVE', 'Your admin account is not active.');
    }
    const includePii = canReadPii(request);
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: adminArtistAccessUserSelect(includePii)
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
        await createAudit(tx, adminAuditData(request, request.user.id, 'USER_SET_ROLE', 'USER', target.id, reason, {
          previousRole: diff.previousRole,
          nextRole: diff.nextRole,
          triggeredBy: 'USER_REVOKE_ARTIST'
        }));
      }
      if (diff.profileHiddenNow) {
        await createAudit(tx, adminAuditData(request, request.user.id, 'ARTIST_HIDE', 'ARTIST', diff.profile.id, reason, {
          userId: target.id,
          triggeredBy: 'USER_REVOKE_ARTIST'
        }));
      }
      if (diff.sessionsRevoked) {
        await createAudit(tx, adminAuditData(request, request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
          revokedCount: diff.revokedSessionCount,
          triggeredBy: 'USER_REVOKE_ARTIST'
        }));
      }
      await createAudit(tx, adminAuditData(request, request.user.id, 'USER_REVOKE_ARTIST', 'USER', target.id, reason, {
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
        ...(includePii ? { email: target.email } : {}),
        username: target.username,
        displayName: target.displayName,
        role: outcome.nextRole,
        status: target.status,
        ...summarizeArtistAccess({ role: outcome.nextRole, status: target.status, artistProfile: outcome.profile })
      }
    };
  });

  fastify.post('/users/:id/ensure-artist-profile', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    if (request.user.status !== 'ACTIVE') {
      return sendAdminError(reply, 403, 'ADMIN_NOT_ACTIVE', 'Your admin account is not active.');
    }
    const includePii = canReadPii(request);
    const target = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: adminArtistAccessUserSelect(includePii)
    });
    if (!target) return sendAdminError(reply, 404, 'ADMIN_USER_NOT_FOUND', 'User not found.');
    const revokeSessions = request.body?.revokeSessions === true;

    const result = await fastify.prisma.$transaction(async (tx) => {
      const ensured = await ensureArtistProfile(tx, target.id);
      await createAudit(tx, adminAuditData(request, request.user.id, 'ARTIST_PROFILE_CREATED', 'ARTIST', ensured.profile.id, reason, {
        userId: target.id,
        alreadyExisted: !ensured.created,
        triggeredBy: 'USER_ENSURE_ARTIST_PROFILE',
        requestId: request.id
      }));
      let revokedSessionCount = null;
      if (revokeSessions) {
        const revoked = await tx.session.deleteMany({ where: { userId: target.id } });
        revokedSessionCount = revoked.count;
        await createAudit(tx, adminAuditData(request, request.user.id, 'USER_REVOKE_SESSIONS', 'USER', target.id, reason, {
          revokedCount: revoked.count,
          triggeredBy: 'USER_ENSURE_ARTIST_PROFILE'
        }));
      }
      return { profile: ensured.profile, created: ensured.created, revokedSessionCount };
    });

    return {
      user: {
        id: target.id,
        ...(includePii ? { email: target.email } : {}),
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

  fastify.get('/tracks', read(ADMIN_PERMISSIONS.TRACKS_READ), async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const search = sanitizeSearch(request.query.search);
    const status = enumFilter(request.query.status, TRACK_STATUSES);
    if (request.query.status && status === undefined) return invalidFilter(reply, 'status');
    const contentTypeResult = parseTrackContentType(request.query.contentType, { defaultValue: null });
    if (!contentTypeResult.ok) {
      return sendAdminError(reply, 400, contentTypeResult.error, contentTypeResult.message);
    }
    const where = {
      ...(status ? { status } : {}),
      ...(contentTypeResult.value ? { contentType: contentTypeResult.value } : {}),
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
          contentType: true,
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

  fastify.get('/tracks/:id', read(ADMIN_PERMISSIONS.TRACKS_READ), async (request, reply) => {
    const track = await fastify.prisma.track.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        title: true,
        slug: true,
        coverUrl: true,
        genre: true,
        contentType: true,
        beatKey: true,
        beatBpm: true,
        beatMood: true,
        beatStyle: true,
        beatLicenseType: true,
        beatUsageNotes: true,
        beatContactEnabled: true,
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
        include: { actor: { select: auditActorSelect() } }
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
      audit: audit.map(publicAuditRecord)
    };
  });

  fastify.get('/tracks/:id/preview', read(ADMIN_PERMISSIONS.TRACKS_PREVIEW), async (request, reply) => {
    const track = await fastify.prisma.track.findUnique({
      where: { id: request.params.id },
      select: { id: true, status: true, processedAudioKey: true, mimeType: true }
    });
    if (!track) return sendAdminError(reply, 404, 'ADMIN_TRACK_NOT_FOUND', 'Track not found.');
    if (!track.processedAudioKey) {
      return sendAdminError(reply, 409, 'ADMIN_PREVIEW_UNAVAILABLE', 'A processed moderation preview is unavailable.');
    }

    const range = request.headers.range;
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
      return sendAdminError(reply, 416, 'ADMIN_INVALID_RANGE', 'Only one valid byte range may be requested.');
    }

    if (typeof fastify.storage?.getObjectMetadata === 'function') {
      const metadata = await fastify.storage.getObjectMetadata(track.processedAudioKey);
      if (!metadata.exists) {
        return sendAdminError(reply, 404, 'ADMIN_PREVIEW_NOT_FOUND', 'The processed preview object is unavailable.');
      }
    }

    let object;
    try {
      if (typeof fastify.storage?.getObjectStreamResponse === 'function') {
        object = await fastify.storage.getObjectStreamResponse(track.processedAudioKey, { range });
      } else if (typeof fastify.storage?.getObjectStream === 'function') {
        object = { body: await fastify.storage.getObjectStream(track.processedAudioKey) };
      } else {
        return sendAdminError(reply, 503, 'ADMIN_PREVIEW_UNAVAILABLE', 'Preview storage is unavailable.');
      }
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 416) {
        return sendAdminError(reply, 416, 'ADMIN_INVALID_RANGE', 'The requested byte range is unavailable.');
      }
      throw error;
    }
    if (!object?.body) {
      return sendAdminError(reply, 404, 'ADMIN_PREVIEW_NOT_FOUND', 'The processed preview object is unavailable.');
    }

    await createAudit(fastify.prisma, adminAuditData(
      request,
      request.user.id,
      'TRACK_PREVIEW',
      'TRACK',
      track.id,
      'Moderation preview requested.',
      { status: track.status, ranged: Boolean(range) }
    ));

    reply.header('Cache-Control', 'private, no-store');
    reply.header('Accept-Ranges', object.acceptRanges || 'bytes');
    reply.header('Content-Disposition', 'inline');
    reply.type(object.contentType || 'audio/mpeg');
    if (object.etag) reply.header('ETag', object.etag);
    if (object.contentRange) reply.header('Content-Range', object.contentRange);
    if (Number.isSafeInteger(object.contentLength) && object.contentLength >= 0) {
      reply.header('Content-Length', object.contentLength);
    }
    if (range && object.contentRange) reply.status(206);
    return reply.send(object.body);
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
      await createAudit(tx, adminAuditData(request, request.user.id, action, 'TRACK', track.id, reason, {
        previousStatus: track.status,
        nextStatus
      }));
    });
    return { track: { id: track.id, status: nextStatus } };
  }

  fastify.post('/tracks/:id/hide', mutate(ADMIN_PERMISSIONS.TRACKS_MANAGE), (request, reply) =>
    setTrackStatus(request, reply, 'HIDDEN', 'TRACK_HIDE', ['PUBLISHED']));
  fastify.post('/tracks/:id/unhide', mutate(ADMIN_PERMISSIONS.TRACKS_MANAGE), (request, reply) =>
    setTrackStatus(request, reply, 'PUBLISHED', 'TRACK_UNHIDE', ['HIDDEN']));
  fastify.post('/tracks/:id/reject', mutate(ADMIN_PERMISSIONS.TRACKS_MANAGE), (request, reply) =>
    setTrackStatus(request, reply, 'REJECTED', 'TRACK_REJECT', ['PUBLISHED', 'PENDING_REVIEW', 'HIDDEN']));
  fastify.post('/tracks/:id/restore', mutate(ADMIN_PERMISSIONS.TRACKS_MANAGE), (request, reply) =>
    setTrackStatus(request, reply, 'PENDING_REVIEW', 'TRACK_RESTORE', ['REJECTED']));

  fastify.post('/tracks/:id/content-type', mutate(ADMIN_PERMISSIONS.TRACKS_MANAGE), async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const track = await fastify.prisma.track.findUnique({ where: { id: request.params.id } });
    if (!track) return sendAdminError(reply, 404, 'ADMIN_TRACK_NOT_FOUND', 'Track not found.');

    const contentTypeResult = parseTrackContentType(request.body?.contentType);
    if (!contentTypeResult.ok) {
      return sendAdminError(reply, 400, contentTypeResult.error, contentTypeResult.message);
    }
    const beatMetadataResult = validateBeatMetadata({ ...track, ...request.body }, {
      contentType: contentTypeResult.value
    });
    if (!beatMetadataResult.ok) {
      return sendAdminError(reply, 400, beatMetadataResult.error, beatMetadataResult.message, {
        field: beatMetadataResult.field
      });
    }

    const updated = await fastify.prisma.$transaction(async (tx) => {
      const next = await tx.track.update({
        where: { id: track.id },
        data: {
          contentType: contentTypeResult.value,
          ...beatMetadataResult.data
        }
      });
      await createAudit(tx, adminAuditData(request,
        request.user.id,
        'TRACK_CONTENT_TYPE_UPDATE',
        'TRACK',
        track.id,
        reason,
        { previousContentType: track.contentType || 'MUSIC', contentType: next.contentType }
      ));
      return next;
    });

    return {
      track: {
        id: updated.id,
        contentType: updated.contentType,
        beatKey: updated.beatKey,
        beatBpm: updated.beatBpm,
        beatMood: updated.beatMood,
        beatStyle: updated.beatStyle,
        beatLicenseType: updated.beatLicenseType,
        beatUsageNotes: updated.beatUsageNotes,
        beatContactEnabled: updated.beatContactEnabled
      }
    };
  });

  fastify.post('/tracks/:id/lyrics/remove', mutate(ADMIN_PERMISSIONS.TRACKS_MANAGE), async (request, reply) => {
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
      await createAudit(tx, adminAuditData(request,
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

  fastify.post('/tracks/:id/force-reprocess', mutate(ADMIN_PERMISSIONS.TRACKS_MANAGE), async (request, reply) => {
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
      const jobId = await enqueueUpload(fastify, upload, request, reason, 'TRACK_FORCE_REPROCESS');
      return { track: { id: track.id, status: 'PROCESSING' }, uploadId: upload.id, jobId };
    } catch (error) {
      if (error.code === 'ADMIN_UPLOAD_OBJECT_MISSING') {
        return sendAdminError(reply, 409, error.code, error.message);
      }
      throw error;
    }
  });

  // --- Uploads -------------------------------------------------------------

  fastify.get('/uploads', read(ADMIN_PERMISSIONS.UPLOADS_READ), async (request, reply) => {
    const includePii = canReadPii(request);
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
          ...(includePii ? [{ user: { email: { contains: search, mode: 'insensitive' } } }] : []),
          { user: { username: { contains: search, mode: 'insensitive' } } },
          { user: { displayName: { contains: search, mode: 'insensitive' } } },
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
          user: { select: { id: true, username: true, displayName: true, ...(includePii ? { email: true } : {}) } },
          track: { select: { id: true, title: true, status: true } }
        }
      })
    ]);
    return {
      data: uploads.map(publicUpload),
      pagination: paginationMeta(total, page, pageSize)
    };
  });

  fastify.get('/uploads/:id', read(ADMIN_PERMISSIONS.UPLOADS_READ), async (request, reply) => {
    const includePii = canReadPii(request);
    const upload = await fastify.prisma.upload.findUnique({
      where: { id: request.params.id },
      include: {
        user: { select: { id: true, username: true, displayName: true, ...(includePii ? { email: true } : {}), status: true } },
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
      include: { actor: { select: auditActorSelect() } }
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
    return { upload: publicUpload(upload), worker, audit: audit.map(publicAuditRecord) };
  });

  fastify.post('/uploads/:id/retry', mutate(ADMIN_PERMISSIONS.UPLOADS_MANAGE), async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const upload = await fastify.prisma.upload.findUnique({ where: { id: request.params.id } });
    if (!upload) return sendAdminError(reply, 404, 'ADMIN_UPLOAD_NOT_FOUND', 'Upload not found.');
    if (upload.status !== 'FAILED') {
      return sendAdminError(reply, 409, 'ADMIN_INVALID_STATE', 'Only failed uploads can be retried.');
    }
    try {
      const jobId = await enqueueUpload(fastify, upload, request, reason, 'UPLOAD_RETRY');
      return { upload: { id: upload.id, status: 'PROCESSING' }, jobId };
    } catch (error) {
      if (error.code === 'ADMIN_UPLOAD_OBJECT_MISSING') {
        return sendAdminError(reply, 409, error.code, error.message);
      }
      throw error;
    }
  });

  fastify.post('/uploads/:id/cancel', mutate(ADMIN_PERMISSIONS.UPLOADS_MANAGE), async (request, reply) => {
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
      await createAudit(tx, adminAuditData(request, request.user.id, 'UPLOAD_CANCEL', 'UPLOAD', upload.id, reason, {
        previousStatus: upload.status,
        trackId: upload.trackId || null
      }));
    });
    return { upload: { id: upload.id, status: 'CANCELLED' } };
  });

  // --- Artists -------------------------------------------------------------

  fastify.get('/artists', read(ADMIN_PERMISSIONS.ARTISTS_READ), async (request) => {
    const includePii = canReadPii(request);
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
            ...(includePii ? [{ email: { contains: search, mode: 'insensitive' } }] : [])
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
          user: { select: { id: true, username: true, displayName: true, ...(includePii ? { email: true } : {}), avatarUrl: true, status: true } },
          _count: { select: { tracks: true, followers: true } }
        }
      })
    ]);
    return { data: artists, pagination: paginationMeta(total, page, pageSize) };
  });

  fastify.get('/artists/:id', read(ADMIN_PERMISSIONS.ARTISTS_READ), async (request, reply) => {
    const includePii = canReadPii(request);
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
            ...(includePii ? { email: true } : {}),
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
        include: { actor: { select: auditActorSelect() } }
      })
    ]);
    return { artist, reports, audit: audit.map(publicAuditRecord) };
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
      await createAudit(tx, adminAuditData(request,
        request.user.id,
        isHidden ? 'ARTIST_HIDE' : 'ARTIST_UNHIDE',
        'ARTIST',
        artist.id,
        reason
      ));
    });
    return { artist: { id: artist.id, isHidden } };
  }
  fastify.post('/artists/:id/hide', mutate(ADMIN_PERMISSIONS.ARTISTS_MANAGE), (request, reply) => setArtistHidden(request, reply, true));
  fastify.post('/artists/:id/unhide', mutate(ADMIN_PERMISSIONS.ARTISTS_MANAGE), (request, reply) => setArtistHidden(request, reply, false));

  // --- Comments ------------------------------------------------------------

  fastify.get('/comments', read(ADMIN_PERMISSIONS.COMMENTS_READ), async (request, reply) => {
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

  fastify.get('/comments/:id', read(ADMIN_PERMISSIONS.COMMENTS_READ), async (request, reply) => {
    const includePii = canReadPii(request);
    const comment = await fastify.prisma.comment.findUnique({
      where: { id: request.params.id },
      select: {
        ...COMMENT_SELECT,
        user: { select: { id: true, username: true, displayName: true, ...(includePii ? { email: true } : {}), status: true } },
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
        include: { actor: { select: auditActorSelect() } }
      })
    ]);
    return { comment, reports, audit: audit.map(publicAuditRecord) };
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
      await createAudit(tx, adminAuditData(request,
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
  fastify.post('/comments/:id/hide', mutate(ADMIN_PERMISSIONS.COMMENTS_MANAGE), (request, reply) => setCommentHidden(request, reply, true));
  fastify.post('/comments/:id/unhide', mutate(ADMIN_PERMISSIONS.COMMENTS_MANAGE), (request, reply) => setCommentHidden(request, reply, false));

  // --- Reports -------------------------------------------------------------

  fastify.get('/reports', read(ADMIN_PERMISSIONS.REPORTS_READ), async (request, reply) => {
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

  fastify.get('/reports/:id', read(ADMIN_PERMISSIONS.REPORTS_READ), async (request, reply) => {
    const includePii = canReadPii(request);
    const report = await fastify.prisma.report.findUnique({
      where: { id: request.params.id },
      include: {
        reporter: { select: { id: true, username: true, displayName: true, ...(includePii ? { email: true } : {}), status: true } },
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
        include: { actor: { select: auditActorSelect() } }
      })
    ]);
    return { report, target, audit: audit.map(publicAuditRecord) };
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
          await createAudit(tx, adminAuditData(request, request.user.id, 'TRACK_HIDE', 'TRACK', track.id, notes, { reportId: report.id }));
        } else if (report.targetType === 'COMMENT') {
          const comment = await tx.comment.findUnique({ where: { id: report.targetId } });
          if (!comment || comment.isDeleted) throw Object.assign(new Error('Target comment cannot be hidden.'), { safeCode: 'ADMIN_TARGET_ACTION_INVALID' });
          await tx.comment.update({
            where: { id: comment.id },
            data: { isDeleted: true, text: '[Removed by moderator]' }
          });
          await createAudit(tx, adminAuditData(request, request.user.id, 'COMMENT_HIDE', 'COMMENT', comment.id, notes, {
            reportId: report.id,
            originalText: comment.text
          }));
        } else if (report.targetType === 'ARTIST') {
          const artist = await tx.artistProfile.findUnique({ where: { id: report.targetId } });
          if (!artist || artist.isHidden) throw Object.assign(new Error('Target artist cannot be hidden.'), { safeCode: 'ADMIN_TARGET_ACTION_INVALID' });
          await tx.artistProfile.update({ where: { id: artist.id }, data: { isHidden: true } });
          await createAudit(tx, adminAuditData(request, request.user.id, 'ARTIST_HIDE', 'ARTIST', artist.id, notes, { reportId: report.id }));
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
        const user = userId ? await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, status: true }
        }) : null;
        if (!user || user.role === 'ADMIN' || user.id === request.user.id || user.status !== 'ACTIVE') {
          throw Object.assign(new Error('The target user cannot be suspended.'), { safeCode: 'ADMIN_TARGET_ACTION_INVALID' });
        }
        await tx.user.update({
          where: { id: user.id },
          data: { status: 'SUSPENDED' },
          select: { id: true }
        });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await createAudit(tx, adminAuditData(request, request.user.id, 'USER_SUSPEND', 'USER', user.id, notes, { reportId: report.id }));
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
      await createAudit(tx, adminAuditData(request, request.user.id, auditAction, 'REPORT', report.id, notes, {
        previousStatus: report.status,
        nextStatus: status,
        targetAction
      }));
    });
    return { report: { id: report.id, status }, targetAction };
  }

  fastify.post('/reports/:id/resolve', mutate(ADMIN_PERMISSIONS.REPORTS_MANAGE), (request, reply) => {
    const legacyAction = request.body?.action;
    const status = legacyAction && ['REVIEWED', 'ACTION_TAKEN'].includes(legacyAction)
      ? legacyAction
      : (request.body?.targetAction && request.body.targetAction !== 'NONE' ? 'ACTION_TAKEN' : 'REVIEWED');
    return decideReport(request, reply, status, 'REPORT_RESOLVE');
  });
  fastify.post('/reports/:id/reject', mutate(ADMIN_PERMISSIONS.REPORTS_MANAGE), (request, reply) =>
    decideReport(request, reply, 'DISMISSED', 'REPORT_REJECT'));
  fastify.post('/reports/:id/escalate', mutate(ADMIN_PERMISSIONS.REPORTS_MANAGE), async (request, reply) => {
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
      await createAudit(tx, adminAuditData(request, request.user.id, 'REPORT_ESCALATE', 'REPORT', report.id, notes));
    });
    return { report: { id: report.id, status: 'ESCALATED' } };
  });

  // --- Audit logs ----------------------------------------------------------

  fastify.get('/audit-logs', read(ADMIN_PERMISSIONS.AUDIT_READ), async (request, reply) => {
    let parsed;
    try {
      parsed = parseAuditListQuery(request.query);
    } catch (error) {
      return auditQueryError(reply, error);
    }
    const { page, pageSize, skip, take } = parsed;
    const includePii = canReadPii(request);
    const where = buildAuditWhere(parsed, { includePii });
    const [total, logs] = await fastify.prisma.$transaction([
      fastify.prisma.auditLog.count({ where }),
      fastify.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: auditActorSelect(includePii) } }
      })
    ]);
    return {
      data: logs.map((log) => publicAuditRecord(log, { includePii })),
      pagination: paginationMeta(total, page, pageSize)
    };
  });

  fastify.get('/audit-logs/export', read(ADMIN_PERMISSIONS.AUDIT_EXPORT), async (request, reply) => {
    let parsed;
    try {
      parsed = parseAuditExportQuery(request.query);
    } catch (error) {
      return auditQueryError(reply, error);
    }
    const includePii = canReadPii(request);
    const logs = await fastify.prisma.auditLog.findMany({
      where: buildAuditWhere(parsed, { includePii }),
      take: parsed.limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { actor: { select: auditActorSelect(includePii) } }
    });
    await createAudit(fastify.prisma, adminAuditData(
      request,
      request.user.id,
      'AUDIT_EXPORT',
      'AUDIT',
      'EXPORT',
      'Audit log CSV export.',
      {
        rowCount: logs.length,
        limit: parsed.limit,
        filters: {
          hasQuery: Boolean(parsed.q),
          action: parsed.action,
          resource: parsed.resource,
          hasActorFilter: Boolean(parsed.actor),
          from: parsed.from,
          to: parsed.to,
          environment: parsed.environment,
          result: parsed.result
        }
      }
    ));
    const date = new Date().toISOString().slice(0, 10);
    reply.header('Cache-Control', 'private, no-store');
    reply.header('Content-Disposition', `attachment; filename="noirsound-audit-${date}.csv"`);
    reply.type('text/csv; charset=utf-8');
    return reply.send(auditLogsCsv(logs, { includePii }));
  });

  fastify.get('/audit-logs/:id', read(ADMIN_PERMISSIONS.AUDIT_READ), async (request, reply) => {
    const includePii = canReadPii(request);
    const log = await fastify.prisma.auditLog.findUnique({
      where: { id: request.params.id },
      include: { actor: { select: auditActorSelect(includePii) } }
    });
    if (!log) return sendAdminError(reply, 404, 'ADMIN_AUDIT_NOT_FOUND', 'Audit entry not found.');
    return { auditLog: publicAuditRecord(log, { includePii }) };
  });

  // --- System --------------------------------------------------------------

  fastify.get('/system', read(ADMIN_PERMISSIONS.SYSTEM_READ), async () => {
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
  fastify.get('/stats/integrity', read(ADMIN_PERMISSIONS.STATS_READ), async (request) => {
    return runStatsIntegrityCheck(fastify.prisma, new Date(), { includePii: canReadPii(request) });
  });

  // POST /admin/stats/recalculate — admin-only, audited, CSRF-protected
  // (global CSRF hook) and rate-limited (adminMutationOptions). Body:
  // { reason, target?: 'monthlyListeners' | 'trackPlays' | 'all' }.
  // Recomputes (never increments) the requested stored aggregate(s) from
  // the real PlayEvent rows, so it is always safe to run repeatedly.
  fastify.post('/stats/recalculate', mutate(ADMIN_PERMISSIONS.STATS_MANAGE), async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');
    const target = ['monthlyListeners', 'trackPlays', 'all'].includes(request.body?.target)
      ? request.body.target
      : 'all';

    const summary = await fastify.prisma.$transaction(async (tx) => {
      const result = { target, monthlyListeners: null, trackPlays: null };
      if (target === 'monthlyListeners' || target === 'all') {
        const rows = await recalculateAllArtistMonthlyListeners(tx);
        result.monthlyListeners = {
          artistsChecked: rows.length,
          artistsChanged: rows.filter((row) => row.changed).length
        };
      }
      if (target === 'trackPlays' || target === 'all') {
        const rows = await recalculateAllTrackPlayCounts(tx);
        result.trackPlays = {
          tracksChecked: rows.length,
          tracksChanged: rows.filter((row) => row.changed).length
        };
      }
      await createAudit(tx, adminAuditData(request,
        request.user.id,
        'STATS_RECALCULATE',
        'SYSTEM',
        'stats',
        reason,
        { requestId: request.id, ...result }
      ));
      return result;
    });

    return { success: true, ...summary };
  });

  // POST /admin/stats/artists/:id/recalculate — same recomputation, scoped
  // to a single artist (used by the per-artist "recalculate" affordance
  // rather than forcing a full-catalog recalculation for a one-off fix).
  fastify.post('/stats/artists/:id/recalculate', mutate(ADMIN_PERMISSIONS.STATS_MANAGE), async (request, reply) => {
    const reason = requiredReason(request.body);
    if (!reason) return sendAdminError(reply, 400, 'ADMIN_REASON_REQUIRED', 'A reason is required.');

    const result = await fastify.prisma.$transaction(async (tx) => {
      const recalculated = await recalculateArtistMonthlyListeners(tx, request.params.id);
      if (!recalculated) return null;
      await createAudit(tx, adminAuditData(request,
        request.user.id,
        'STATS_RECALCULATE',
        'ARTIST',
        request.params.id,
        reason,
        { requestId: request.id, ...recalculated }
      ));
      return recalculated;
    });
    if (!result) return sendAdminError(reply, 404, 'ADMIN_ARTIST_NOT_FOUND', 'Artist profile not found.');

    return { success: true, ...result };
  });

  // ==========================================
  // CREATOR REGISTRATIONS MANAGEMENT
  // ==========================================

  // GET /admin/creators — List creator registrations with filters, search, and upload access state
  fastify.get('/creators', read(ADMIN_PERMISSIONS.USERS_READ), async (request, _reply) => {
    const {
      page: pageRaw = 1,
      limit: limitRaw = 20,
      q,
      creatorType,
      status,
      uploadAccess
    } = request.query || {};

    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {};
    if (status && status !== 'ALL' && CREATOR_STATUSES.includes(status)) {
      where.status = status;
    }
    if (creatorType && creatorType !== 'ALL' && CREATOR_TYPES.includes(creatorType)) {
      where.creatorType = creatorType;
    }
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const cleanQ = q.trim();
      where.OR = [
        { displayName: { contains: cleanQ, mode: 'insensitive' } },
        { user: { username: { contains: cleanQ, mode: 'insensitive' } } },
        { user: { displayName: { contains: cleanQ, mode: 'insensitive' } } },
        { user: { email: { contains: cleanQ, mode: 'insensitive' } } }
      ];
    }

    const [totalMatching, rawItems, countsGroup] = await Promise.all([
      fastify.prisma.creatorRegistration.count({ where }),
      fastify.prisma.creatorRegistration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              email: true,
              role: true,
              status: true,
              joinedAt: true,
              artistProfile: {
                select: { id: true, isHidden: true }
              }
            }
          }
        }
      }),
      fastify.prisma.creatorRegistration.groupBy({
        by: ['status'],
        _count: { status: true }
      })
    ]);

    const counts = {
      REGISTERED: 0,
      REVIEWED: 0,
      ENABLED: 0,
      TOTAL: 0
    };
    for (const group of countsGroup) {
      counts[group.status] = group._count.status;
      counts.TOTAL += group._count.status;
    }

    let items = rawItems.map((item) => {
      const userAccess = summarizeArtistAccess(item.user);
      return {
        ...item,
        userAccess
      };
    });

    if (uploadAccess === 'GRANTED') {
      items = items.filter((i) => i.userAccess.canUploadTracks);
    } else if (uploadAccess === 'NOT_GRANTED') {
      items = items.filter((i) => !i.userAccess.canUploadTracks);
    }

    return {
      items,
      counts,
      pagination: {
        page,
        limit,
        total: totalMatching,
        totalPages: Math.ceil(totalMatching / limit) || 1
      }
    };
  });

  // GET /admin/creators/export — Export creator registrations as CSV with formula injection escaping
  fastify.get('/creators/export', read(ADMIN_PERMISSIONS.USERS_READ), async (request, reply) => {
    const { q, creatorType, status } = request.query || {};

    const where = {};
    if (status && status !== 'ALL' && CREATOR_STATUSES.includes(status)) {
      where.status = status;
    }
    if (creatorType && creatorType !== 'ALL' && CREATOR_TYPES.includes(creatorType)) {
      where.creatorType = creatorType;
    }
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const cleanQ = q.trim();
      where.OR = [
        { displayName: { contains: cleanQ, mode: 'insensitive' } },
        { user: { username: { contains: cleanQ, mode: 'insensitive' } } },
        { user: { displayName: { contains: cleanQ, mode: 'insensitive' } } },
        { user: { email: { contains: cleanQ, mode: 'insensitive' } } }
      ];
    }

    const items = await fastify.prisma.creatorRegistration.findMany({
      where,
      take: 1000,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            status: true,
            artistProfile: {
              select: { id: true, isHidden: true }
            }
          }
        }
      }
    });

    const enriched = items.map((item) => {
      const userAccess = summarizeArtistAccess(item.user);
      return {
        ...item,
        user: {
          ...item.user,
          canUploadTracks: userAccess.canUploadTracks
        }
      };
    });

    const csvData = formatCreatorsCsv(enriched);

    await createAudit(fastify.prisma, adminAuditData(request,
      request.user.id,
      'CREATORS_EXPORTED',
      'SYSTEM',
      'creators',
      'Exported creator registrations CSV',
      { count: items.length }
    ));

    const filename = `noirsound-creators-${new Date().toISOString().slice(0, 10)}.csv`;
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(csvData);
  });

  // GET /admin/creators/:id — Detail of a creator registration
  fastify.get('/creators/:id', read(ADMIN_PERMISSIONS.USERS_READ), async (request, reply) => {
    const id = request.params.id;

    const registration = await fastify.prisma.creatorRegistration.findFirst({
      where: {
        OR: [{ id }, { userId: id }]
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            status: true,
            joinedAt: true,
            artistProfile: true
          }
        }
      }
    });

    if (!registration) {
      return sendAdminError(reply, 404, 'CREATOR_REGISTRATION_NOT_FOUND', 'Creator registration not found.');
    }

    const userAccess = summarizeArtistAccess(registration.user);

    const auditLogs = await fastify.prisma.auditLog.findMany({
      where: {
        targetType: 'USER',
        targetId: registration.user.id
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return {
      creator: registration,
      userAccess,
      auditLogs
    };
  });

  // PATCH /admin/creators/:id/status — Transition creator registration status
  fastify.patch('/creators/:id/status', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), async (request, reply) => {
    const id = request.params.id;
    const { status, reason } = request.body || {};

    if (!status || !CREATOR_STATUSES.includes(status)) {
      return sendAdminError(reply, 400, 'INVALID_STATUS', `Status must be one of: ${CREATOR_STATUSES.join(', ')}`);
    }

    const existing = await fastify.prisma.creatorRegistration.findFirst({
      where: {
        OR: [{ id }, { userId: id }]
      }
    });

    if (!existing) {
      return sendAdminError(reply, 404, 'CREATOR_REGISTRATION_NOT_FOUND', 'Creator registration not found.');
    }

    const updateData = { status };
    if (status === 'REVIEWED') {
      updateData.reviewedAt = new Date();
    } else if (status === 'ENABLED') {
      updateData.enabledAt = new Date();
    }

    const updated = await fastify.prisma.creatorRegistration.update({
      where: { id: existing.id },
      data: updateData
    });

    await createAudit(fastify.prisma, adminAuditData(request,
      request.user.id,
      'CREATOR_STATUS_CHANGED',
      'USER',
      existing.userId,
      reason || `Changed status from ${existing.status} to ${status}`,
      { previousStatus: existing.status, nextStatus: status }
    ));

    return { creator: updated };
  });

  // PATCH /admin/creators/:id/note — Update admin internal evaluation note
  fastify.patch('/creators/:id/note', mutate(ADMIN_PERMISSIONS.USERS_MANAGE), async (request, reply) => {
    const id = request.params.id;
    const { note } = request.body || {};

    if (note !== null && typeof note !== 'string') {
      return sendAdminError(reply, 400, 'INVALID_NOTE', 'Note must be a string or null.');
    }

    const trimmed = note ? note.trim().slice(0, MAX_ADMIN_NOTE_LENGTH) : null;

    const existing = await fastify.prisma.creatorRegistration.findFirst({
      where: {
        OR: [{ id }, { userId: id }]
      }
    });

    if (!existing) {
      return sendAdminError(reply, 404, 'CREATOR_REGISTRATION_NOT_FOUND', 'Creator registration not found.');
    }

    const updated = await fastify.prisma.creatorRegistration.update({
      where: { id: existing.id },
      data: { adminNote: trimmed }
    });

    await createAudit(fastify.prisma, adminAuditData(request,
      request.user.id,
      'CREATOR_ADMIN_NOTE_UPDATED',
      'USER',
      existing.userId,
      'Updated creator registration admin note',
      { noteLength: trimmed ? trimmed.length : 0 }
    ));

    return { creator: updated };
  });
}

module.exports = adminRoutes;
