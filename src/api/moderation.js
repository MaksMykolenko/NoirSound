// Reporting + admin moderation API.
// These are real-backend features (no mock variant): they call the live API
// client directly regardless of demo mode.
import { apiFetch } from './client';

export const REPORT_REASONS = ['COPYRIGHT', 'SPAM', 'HARASSMENT', 'HATE', 'NSFW', 'OTHER'];

export async function submitReport({ targetType, targetId, reason, details }) {
  return apiFetch('/reports', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, reason, details }),
  });
}

// --- Admin ---------------------------------------------------------------

export async function getAdminSummary() {
  return apiFetch('/admin/summary', { suppressErrorToast: true });
}

export async function getReports(status) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiFetch(`/admin/reports${qs}`, { suppressErrorToast: true });
  return res.data || [];
}

export async function resolveReport(id, action, notes) {
  return apiFetch(`/admin/reports/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action, notes }),
  });
}

export async function hideTrack(id, reason) {
  return apiFetch(`/admin/tracks/${id}/hide`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function unhideTrack(id) {
  return apiFetch(`/admin/tracks/${id}/unhide`, { method: 'POST', body: JSON.stringify({}) });
}

export async function hideComment(id, reason) {
  return apiFetch(`/admin/comments/${id}/hide`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function suspendUser(id, reason) {
  return apiFetch(`/admin/users/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function unsuspendUser(id) {
  return apiFetch(`/admin/users/${id}/unsuspend`, { method: 'POST', body: JSON.stringify({}) });
}

export async function getAuditLogs() {
  const res = await apiFetch('/admin/audit-logs', { suppressErrorToast: true });
  return res.data || [];
}
