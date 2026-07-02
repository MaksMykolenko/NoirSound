import { apiFetch } from '../client';

function queryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

function get(path, params) {
  return apiFetch(`${path}${queryString(params)}`, { suppressErrorToast: true });
}

function mutate(path, body = {}) {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const getAdminOverview = () => get('/admin/overview');

export const getAdminUsers = (params) => get('/admin/users', params);
export const getAdminUser = (id) => get(`/admin/users/${encodeURIComponent(id)}`);
export const updateAdminUser = (id, payload) => apiFetch(`/admin/users/${encodeURIComponent(id)}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
});
export const suspendUser = (id, reason) => mutate(`/admin/users/${encodeURIComponent(id)}/suspend`, { reason });
export const unsuspendUser = (id, reason) => mutate(`/admin/users/${encodeURIComponent(id)}/unsuspend`, { reason });
export const banUser = (id, reason) => mutate(`/admin/users/${encodeURIComponent(id)}/ban`, { reason });
export const unbanUser = (id, reason) => mutate(`/admin/users/${encodeURIComponent(id)}/unban`, { reason });
export const revokeUserSessions = (id, reason) => mutate(`/admin/users/${encodeURIComponent(id)}/revoke-sessions`, { reason });
export const setUserRole = (id, role, reason, options = {}) => mutate(`/admin/users/${encodeURIComponent(id)}/set-role`, {
  role,
  reason,
  confirmation: 'SET_ROLE',
  ...options,
});

// Artist access — grant/revoke bundle a role change, an ArtistProfile
// create/hide, and an optional session revocation into one auditable action.
// See backend/src/lib/artistAccess.js.
export const grantArtistAccess = (id, payload) => mutate(`/admin/users/${encodeURIComponent(id)}/grant-artist`, payload);
export const revokeArtistAccess = (id, payload) => mutate(`/admin/users/${encodeURIComponent(id)}/revoke-artist`, payload);
export const ensureArtistProfile = (id, payload) => mutate(`/admin/users/${encodeURIComponent(id)}/ensure-artist-profile`, payload);

export const getAdminTracks = (params) => get('/admin/tracks', params);
export const getAdminTrack = (id) => get(`/admin/tracks/${encodeURIComponent(id)}`);
export const hideTrack = (id, reason) => mutate(`/admin/tracks/${encodeURIComponent(id)}/hide`, { reason });
export const unhideTrack = (id, reason) => mutate(`/admin/tracks/${encodeURIComponent(id)}/unhide`, { reason });
export const rejectTrack = (id, reason) => mutate(`/admin/tracks/${encodeURIComponent(id)}/reject`, { reason });
export const restoreTrack = (id, reason) => mutate(`/admin/tracks/${encodeURIComponent(id)}/restore`, { reason });
export const forceReprocessTrack = (id, reason) => mutate(`/admin/tracks/${encodeURIComponent(id)}/force-reprocess`, { reason });

export const getAdminArtists = (params) => get('/admin/artists', params);
export const getAdminArtist = (id) => get(`/admin/artists/${encodeURIComponent(id)}`);
export const hideArtist = (id, reason) => mutate(`/admin/artists/${encodeURIComponent(id)}/hide`, { reason });
export const unhideArtist = (id, reason) => mutate(`/admin/artists/${encodeURIComponent(id)}/unhide`, { reason });

export const getAdminUploads = (params) => get('/admin/uploads', params);
export const getAdminUpload = (id) => get(`/admin/uploads/${encodeURIComponent(id)}`);
export const retryUpload = (id, reason) => mutate(`/admin/uploads/${encodeURIComponent(id)}/retry`, { reason });
export const cancelUpload = (id, reason) => mutate(`/admin/uploads/${encodeURIComponent(id)}/cancel`, { reason });

export const getAdminReports = (params) => get('/admin/reports', params);
export const getAdminReport = (id) => get(`/admin/reports/${encodeURIComponent(id)}`);
export const resolveReport = (id, payload) => mutate(`/admin/reports/${encodeURIComponent(id)}/resolve`, payload);
export const rejectReport = (id, reason) => mutate(`/admin/reports/${encodeURIComponent(id)}/reject`, { reason });
export const escalateReport = (id, reason) => mutate(`/admin/reports/${encodeURIComponent(id)}/escalate`, { reason });

export const getAdminComments = (params) => get('/admin/comments', params);
export const getAdminComment = (id) => get(`/admin/comments/${encodeURIComponent(id)}`);
export const hideComment = (id, reason) => mutate(`/admin/comments/${encodeURIComponent(id)}/hide`, { reason });
export const unhideComment = (id, reason) => mutate(`/admin/comments/${encodeURIComponent(id)}/unhide`, { reason });

export const getAuditLogs = (params) => get('/admin/audit-logs', params);
export const getAuditLog = (id) => get(`/admin/audit-logs/${encodeURIComponent(id)}`);
export const getAdminSystem = () => get('/admin/system');

// Stats integrity — see backend/src/lib/statsIntegrity.js and
// backend/src/lib/statsAccess.js. The integrity read shares its checks
// verbatim with `npm run stats:check`; the recalculate actions are pure
// recomputations (never increments), so they are always safe to re-run.
export const getStatsIntegrity = () => get('/admin/stats/integrity');
export const recalculateStats = (reason, target = 'all') => mutate('/admin/stats/recalculate', { reason, target });
export const recalculateArtistStats = (id, reason) => mutate(`/admin/stats/artists/${encodeURIComponent(id)}/recalculate`, { reason });
