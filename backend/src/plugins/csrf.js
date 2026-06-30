'use strict';

const fp = require('fastify-plugin');
const { getAllowedOrigins } = require('../config');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Pure CSRF decision used by the request hook (and unit tests).
 *
 * Strategy: strict Origin/Referer validation for state-changing, cookie
 * authenticated browser requests. Browsers always attach an `Origin` header to
 * credentialed unsafe-method requests, so a forged cross-site POST is rejected.
 * Requests with no session cookie carry no ambient credential to forge, and
 * non-browser clients (no Origin AND no Referer, e.g. server-to-server or the
 * test harness) are not a CSRF vector, so both are allowed.
 *
 * @returns {boolean} true if the request may proceed.
 */
function isCsrfSafe({ method, hasSessionCookie, origin, referer, allowedOrigins }) {
  if (SAFE_METHODS.has(String(method).toUpperCase())) return true;
  if (!hasSessionCookie) return true;

  const allow = new Set(allowedOrigins || []);

  if (origin) {
    return allow.has(origin);
  }
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return allow.has(refOrigin);
    } catch {
      return false;
    }
  }
  // No Origin and no Referer => not a browser-originated credentialed request.
  return true;
}

module.exports = fp(async (fastify) => {
  const allowedOrigins = getAllowedOrigins(process.env);

  fastify.addHook('onRequest', async (request, reply) => {
    // Read the raw Cookie header so this does not depend on cookie-plugin
    // hook ordering.
    const rawCookie = request.headers.cookie || '';
    const hasSessionCookie = /(?:^|;\s*)token=/.test(rawCookie);
    const ok = isCsrfSafe({
      method: request.method,
      hasSessionCookie,
      origin: request.headers.origin,
      referer: request.headers.referer || request.headers.referrer,
      allowedOrigins
    });
    if (!ok) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'CSRF_VALIDATION_FAILED',
        message: 'Cross-origin state-changing request rejected.'
      });
    }
  });
});

module.exports.isCsrfSafe = isCsrfSafe;
