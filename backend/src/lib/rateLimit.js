'use strict';

/**
 * Keep production limits fixed while allowing repeated/parallel local E2E runs
 * to opt into a larger budget through RATE_LIMIT_MULTIPLIER.
 */
function scaledRateLimitMax(base, env = process.env) {
  if (env.NODE_ENV === 'production') return base;
  const multiplier = Number(env.RATE_LIMIT_MULTIPLIER || 1);
  if (!Number.isFinite(multiplier) || multiplier < 1) return base;
  return base * Math.min(Math.floor(multiplier), 100);
}

module.exports = { scaledRateLimitMax };
