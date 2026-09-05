'use strict';

const { userOrIpKey } = require('./rateLimitKeys');
const { scaledRateLimitMax } = require('./rateLimit');

const ADMIN_PERMISSIONS = Object.freeze({
  OVERVIEW_READ: 'admin.overview.read',
  SEARCH_READ: 'admin.search.read',
  USERS_READ: 'admin.users.read',
  USERS_MANAGE: 'admin.users.manage',
  TRACKS_READ: 'admin.tracks.read',
  TRACKS_MANAGE: 'admin.tracks.manage',
  TRACKS_PREVIEW: 'admin.tracks.preview',
  UPLOADS_READ: 'admin.uploads.read',
  UPLOADS_MANAGE: 'admin.uploads.manage',
  ARTISTS_READ: 'admin.artists.read',
  ARTISTS_MANAGE: 'admin.artists.manage',
  COMMENTS_READ: 'admin.comments.read',
  COMMENTS_MANAGE: 'admin.comments.manage',
  REPORTS_READ: 'admin.reports.read',
  REPORTS_MANAGE: 'admin.reports.manage',
  AUDIT_READ: 'admin.audit.read',
  AUDIT_EXPORT: 'admin.audit.export',
  PII_READ: 'pii.read',
  SYSTEM_READ: 'admin.system.read',
  STATS_READ: 'admin.stats.read',
  STATS_MANAGE: 'admin.stats.manage'
});

const KNOWN_ADMIN_PERMISSIONS = new Set(Object.values(ADMIN_PERMISSIONS));
const ROLE_PERMISSIONS = Object.freeze({
  LISTENER: Object.freeze([]),
  ARTIST: Object.freeze([]),
  ADMIN: Object.freeze(
    [...KNOWN_ADMIN_PERMISSIONS].filter((permission) => permission !== ADMIN_PERMISSIONS.PII_READ)
  )
});

function hasAdminPermission(role, permission) {
  if (!KNOWN_ADMIN_PERMISSIONS.has(permission)) return false;
  return Boolean(ROLE_PERMISSIONS[role]?.includes(permission));
}

function adminPermissionGuard(permission) {
  return async function requireAdminPermission(request, reply) {
    if (!hasAdminPermission(request.user?.role, permission)) {
      return reply.status(403).send({
        error: 'ADMIN_PERMISSION_DENIED',
        message: 'You do not have permission to perform this admin operation.'
      });
    }
  };
}

function adminReadOptions(fastify, permission) {
  return {
    preValidation: [fastify.authenticate, adminPermissionGuard(permission)],
    config: { adminPermission: KNOWN_ADMIN_PERMISSIONS.has(permission) ? permission : null }
  };
}

function adminMutationOptions(fastify, permission) {
  return {
    preValidation: [fastify.authenticate, adminPermissionGuard(permission)],
    config: {
      adminPermission: KNOWN_ADMIN_PERMISSIONS.has(permission) ? permission : null,
      rateLimit: {
        max: scaledRateLimitMax(60),
        timeWindow: '10 minutes',
        keyGenerator: userOrIpKey
      }
    }
  };
}

function sendAdminError(reply, status, code, message, details = {}) {
  return reply.status(status).send({ error: code, message, ...details });
}

function requiredReason(body, maxLength = 1000) {
  if (!body || typeof body.reason !== 'string') return null;
  const reason = body.reason.trim();
  if (!reason || reason.length > maxLength) return null;
  return reason;
}

module.exports = {
  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  hasAdminPermission,
  adminPermissionGuard,
  adminReadOptions,
  adminMutationOptions,
  sendAdminError,
  requiredReason
};
