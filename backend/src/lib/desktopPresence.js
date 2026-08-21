'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const DEFAULT_DEVICE_CODE_TTL_SECONDS = 600; // 10 minutes
const DEFAULT_PRESENCE_TTL_SECONDS = 60; // 60 seconds
const DEFAULT_PAUSE_PRESENCE_TTL_SECONDS = 15; // 15 seconds
const DEVICE_ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
const DISCORD_APP_ID = process.env.DISCORD_APPLICATION_ID || '1540281435296895066';

const ALLOWED_PRESENCE_EVENTS = new Set([
  'play',
  'resume',
  'pause',
  'seek',
  'ended',
  'stop',
  'heartbeat'
]);

const ALLOWED_COVER_HOSTS = new Set([
  'noirsound.co',
  'cdn.noirsound.co',
  'localhost',
  '127.0.0.1'
]);

/**
 * Generate an unambiguous user code (e.g. "K7F4-M2QP")
 */
function generateUserCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes 0, 1, I, O
  let code = '';
  const randomBytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes[i] % chars.length];
    if (i === 3) code += '-';
  }
  return code;
}

/**
 * Generate an opaque high-entropy device code
 */
function generateDeviceCode() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate an opaque high-entropy refresh token
 */
function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a refresh token for storage
 */
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Sign a short-lived device access token
 */
function signDeviceAccessToken(userId, deviceId, secret = process.env.JWT_SECRET) {
  if (!secret) throw new Error('JWT_SECRET is required');
  return jwt.sign(
    {
      sub: userId,
      deviceId,
      type: 'desktop_device_access',
      scopes: ['desktop_presence:read', 'desktop_device:heartbeat']
    },
    secret,
    { expiresIn: DEVICE_ACCESS_TOKEN_EXPIRY_SECONDS }
  );
}

/**
 * Verify a device access token
 */
function verifyDeviceAccessToken(token, secret = process.env.JWT_SECRET) {
  if (!secret) throw new Error('JWT_SECRET is required');
  try {
    const decoded = jwt.verify(token, secret);
    if (decoded.type !== 'desktop_device_access' || !decoded.sub || !decoded.deviceId) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Unicode-safe string truncation
 */
function truncateString(str, maxLength = 128) {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  const chars = Array.from(trimmed);
  if (chars.length <= maxLength) return trimmed;
  return chars.slice(0, maxLength).join('');
}

/**
 * Formats a canonical, backend-authoritative presence track payload
 */
function formatAuthoritativeTrack(track, positionMs = 0, frontendOrigin = 'https://noirsound.co') {
  if (!track) return null;

  const durationMs = Math.max(0, Math.round((track.durationSeconds || track.duration || 0) * 1000));
  const clampedPositionMs = Math.max(0, Math.min(positionMs, durationMs + 10000));

  let coverUrl = null;
  if (track.coverUrl && /^https?:\/\//i.test(track.coverUrl)) {
    try {
      const parsed = new URL(track.coverUrl);
      if (ALLOWED_COVER_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith('.noirsound.co')) {
        coverUrl = track.coverUrl;
      }
    } catch {
      coverUrl = null;
    }
  }

  // If no allowed external absolute cover, use the stable internal route
  if (!coverUrl) {
    const origin = (frontendOrigin || 'https://noirsound.co').replace(/\/+$/, '');
    coverUrl = `${origin}/api/public/covers/${track.id}`;
  }

  const origin = (frontendOrigin || 'https://noirsound.co').replace(/\/+$/, '');
  const shareUrl = `${origin}/track/${track.id}`;

  const artistName = track.primaryArtistName
    || track.artist?.user?.displayName
    || track.artist?.user?.username
    || 'Unknown Artist';

  return {
    id: track.id,
    title: truncateString(track.title, 128),
    artistName: truncateString(artistName, 128),
    albumTitle: track.album?.title ? truncateString(track.album.title, 128) : null,
    durationMs,
    positionMs: clampedPositionMs,
    coverUrl,
    shareUrl
  };
}

module.exports = {
  DEFAULT_DEVICE_CODE_TTL_SECONDS,
  DEFAULT_PRESENCE_TTL_SECONDS,
  DEFAULT_PAUSE_PRESENCE_TTL_SECONDS,
  DEVICE_ACCESS_TOKEN_EXPIRY_SECONDS,
  DISCORD_APP_ID,
  ALLOWED_PRESENCE_EVENTS,
  ALLOWED_COVER_HOSTS,
  generateUserCode,
  generateDeviceCode,
  generateRefreshToken,
  hashRefreshToken,
  signDeviceAccessToken,
  verifyDeviceAccessToken,
  truncateString,
  formatAuthoritativeTrack
};
