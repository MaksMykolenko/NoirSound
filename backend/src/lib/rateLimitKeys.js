'use strict';

const jwt = require('jsonwebtoken');

/**
 * Rate-limit key generator that runs at the onRequest stage (before auth/body
 * parsing). It derives a per-user key from the session cookie when present so
 * authenticated abuse is limited per account, falling back to the client IP.
 *
 * Only verified JWTs may select a user key. An unsigned decode would let an
 * attacker forge another user's id and consume that user's rate-limit budget.
 */
function userOrIpKey(request) {
  const raw = request.headers.cookie || '';
  const match = /(?:^|;\s*)token=([^;]+)/.exec(raw);
  if (match && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(decodeURIComponent(match[1]), process.env.JWT_SECRET);
      if (decoded && decoded.userId) return `user:${decoded.userId}`;
    } catch {
      /* fall through to IP */
    }
  }
  return `ip:${request.ip}`;
}

module.exports = { userOrIpKey };
