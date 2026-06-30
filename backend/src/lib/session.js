'use strict';

const crypto = require('crypto');

const SESSION_TTL_DAYS = 7;

/**
 * Hash a bearer token (the signed JWT) before persisting it. We never store the
 * raw JWT in the database — only a one-way hash used as a server-side
 * revocation handle. Revoking = deleting the row.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** New opaque session id embedded in the JWT (`sid` claim). */
function newSessionId() {
  return crypto.randomUUID();
}

/** Expiry Date for a session/token. */
function sessionExpiry(days = SESSION_TTL_DAYS, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

module.exports = { SESSION_TTL_DAYS, hashToken, newSessionId, sessionExpiry };
