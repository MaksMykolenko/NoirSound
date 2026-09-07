'use strict';

const CREATOR_TYPES = Object.freeze(['ARTIST', 'BEATMAKER', 'BOTH']);
const CREATOR_STATUSES = Object.freeze(['REGISTERED', 'REVIEWED', 'ENABLED']);

const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_NOTE_LENGTH = 1000;
const MAX_ADMIN_NOTE_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;

/**
 * Validate external portfolio or platform URL.
 * Only HTTPS URLs are permitted (or localhost in non-production).
 */
function isValidExternalUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return false;

  try {
    const parsed = new URL(trimmed);
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost');
    }
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitize and validate optional creator external links.
 */
function sanitizeUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;
  const trimmed = urlString.trim();
  if (!trimmed) return null;
  if (!isValidExternalUrl(trimmed)) {
    throw new Error('External URLs must be valid HTTPS addresses.');
  }
  return trimmed;
}

/**
 * Escape a single CSV cell to prevent spreadsheet formula injection.
 * RFC 4180 requires double-quote escaping. If the cell begins with
 * '=', '+', '-', '@', '\t', or '\r', prefix with a single quote.
 */
function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Format creator registrations array as a safe CSV string.
 */
function formatCreatorsCsv(registrations) {
  const headers = [
    'Registration ID',
    'User ID',
    'Username',
    'User Email',
    'Account Role',
    'Account Status',
    'Creator Type',
    'Display Name',
    'Intends Music',
    'Intends Beats',
    'Portfolio URL',
    'Primary Platform URL',
    'Registration Status',
    'Can Upload Tracks',
    'Registered At',
    'Admin Note'
  ];

  const rows = [headers.map(escapeCsvCell).join(',')];

  for (const item of registrations) {
    const user = item.user || {};
    const row = [
      item.id,
      user.id || '',
      user.username || '',
      user.email || '',
      user.role || '',
      user.status || '',
      item.creatorType,
      item.displayName || user.displayName || '',
      item.intendsMusic ? 'YES' : 'NO',
      item.intendsBeats ? 'YES' : 'NO',
      item.portfolioUrl || '',
      item.primaryPlatformUrl || '',
      item.status,
      user.canUploadTracks ? 'YES' : 'NO',
      item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt || ''),
      item.adminNote || ''
    ];
    rows.push(row.map(escapeCsvCell).join(','));
  }

  return rows.join('\r\n');
}

module.exports = {
  CREATOR_TYPES,
  CREATOR_STATUSES,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_ADMIN_NOTE_LENGTH,
  MAX_URL_LENGTH,
  isValidExternalUrl,
  sanitizeUrl,
  escapeCsvCell,
  formatCreatorsCsv
};
