'use strict';

const fp = require('fastify-plugin');
const { getAllowedOrigins } = require('../config');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Parse the `host[:port]` of a URL-like string (an Origin or Referer header),
 * or null when it cannot be parsed (e.g. the literal "null" Origin).
 */
function hostOf(urlLike) {
  if (!urlLike) return null;
  try {
    return new URL(urlLike).host;
  } catch {
    return null;
  }
}

/**
 * Pure CSRF decision used by the request hook (and unit tests).
 *
 * Strategy: strict Origin/Referer validation for state-changing, cookie
 * authenticated browser requests. A request is accepted when EITHER:
 *
 *   1. its Origin/Referer host equals the `Host` the browser connected to — a
 *      genuine same-origin request. This is the production case: the SPA is
 *      served from the same host that proxies `/api` through Caddy, so the
 *      browser's Origin always matches Host. OR
 *   2. its Origin/Referer origin is present in the configured allowlist
 *      (FRONTEND_ORIGIN) — for intentionally configured cross-origin clients.
 *
 * The same-origin (Origin == Host) check is the canonical CSRF defense and does
 * NOT weaken protection: a forged cross-site request necessarily carries a
 * different Origin than the target Host, so it fails check #1, and an attacker
 * origin is not in the allowlist, so it fails check #2 — it is still rejected.
 * What this fixes is the brittle failure mode where a legitimate same-origin
 * save was rejected only because the live host (apex vs. www, or a freshly
 * provisioned domain) had drifted from the FRONTEND_ORIGIN value.
 *
 * Requests with no session cookie carry no ambient credential to forge, and
 * non-browser clients (no Origin AND no Referer, e.g. server-to-server or the
 * test harness) are not a CSRF vector, so both are allowed.
 *
 * @returns {boolean} true if the request may proceed.
 */
function isCsrfSafe({ method, hasSessionCookie, origin, referer, host, allowedOrigins }) {
  if (SAFE_METHODS.has(String(method).toUpperCase())) return true;
  if (!hasSessionCookie) return true;

  const allow = new Set(allowedOrigins || []);

  if (origin) {
    // Same-origin: the page that issued the request is the host it connected to.
    if (host && hostOf(origin) === host) return true;
    return allow.has(origin);
  }
  if (referer) {
    let refUrl;
    try {
      refUrl = new URL(referer);
    } catch {
      return false;
    }
    if (host && refUrl.host === host) return true; // same-origin
    return allow.has(refUrl.origin);
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
      // `Host` is set by the browser to the target host and is preserved by
      // Caddy's reverse_proxy, so it reflects the origin the user actually
      // browsed (apex or www) rather than the internal upstream address.
      host: request.headers.host,
      allowedOrigins
    });
    if (!ok) {
      // Keep the stable machine-readable code for clients/log correlation, and
      // log the rejected origin/host (never any cookie/secret) for ops triage.
      request.log.warn(
        {
          event: 'csrf_rejected',
          method: request.method,
          url: request.url,
          origin: request.headers.origin || null,
          referer: request.headers.referer || request.headers.referrer || null,
          host: request.headers.host || null
        },
        'CSRF_VALIDATION_FAILED: cross-origin state-changing request rejected'
      );
      return reply.status(403).send({
        statusCode: 403,
        error: 'CSRF_VALIDATION_FAILED',
        message: 'Cross-origin state-changing request rejected.'
      });
    }
  });
});

module.exports.isCsrfSafe = isCsrfSafe;
