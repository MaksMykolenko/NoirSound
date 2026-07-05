// Public reporting API. Admin operations live in src/api/admin.js.
import { apiFetch } from './client';

export const REPORT_REASONS = [
  'COPYRIGHT',
  'LYRICS_COPYRIGHT',
  'LYRICS_OFFENSIVE',
  'LYRICS_INCORRECT',
  'SPAM',
  'HARASSMENT',
  'HATE',
  'NSFW',
  'OTHER',
];

export async function submitReport({ targetType, targetId, reason, details }) {
  return apiFetch('/reports', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, reason, details }),
  });
}
