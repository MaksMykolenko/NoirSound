'use strict';

/**
 * Centralized environment configuration + validation for NoirSound.
 *
 * Goals:
 *  - The app refuses to start in production with missing/weak secrets.
 *  - In dev/test we only require what is genuinely needed to boot, so the
 *    existing test suite and local workflow keep working.
 *
 * `evaluateConfig(env)` is a PURE function (no process.exit / throw) so it can
 * be unit-tested without a database or live services.
 */

const MIN_SECRET_LENGTH = 32;

// Values that must never appear as secrets in production.
const WEAK_SECRET_VALUES = new Set([
  'secret',
  'changeme',
  'change-me',
  'password',
  'jwt_secret',
  'cookie_secret',
  'dev',
  'development',
  'test',
  'noirsound',
  'minioadmin'
]);

function isWeakSecret(value) {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (trimmed.length < MIN_SECRET_LENGTH) return true;
  if (WEAK_SECRET_VALUES.has(trimmed.toLowerCase())) return true;
  // Reject low-entropy single-character or obviously repeated strings.
  if (/^(.)\1+$/.test(trimmed)) return true;
  return false;
}

/**
 * Pure evaluation of an env-like object.
 * @returns {{ errors: string[], warnings: string[], isProduction: boolean }}
 */
function evaluateConfig(env = {}) {
  const errors = [];
  const warnings = [];
  const isProduction = env.NODE_ENV === 'production';

  // --- Always required to boot (any environment) ---
  if (!env.JWT_SECRET) errors.push('JWT_SECRET is required.');
  if (!env.COOKIE_SECRET) errors.push('COOKIE_SECRET is required.');
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required.');

  // --- Required for queues + rate limiting ---
  const hasRedis = Boolean(env.REDIS_URL || env.REDIS_HOST);
  if (!hasRedis) {
    if (isProduction) errors.push('REDIS_URL (or REDIS_HOST) is required for the queue and rate limiter.');
    else warnings.push('REDIS_URL/REDIS_HOST not set — queue and Redis-backed rate limiting will be unavailable.');
  }

  // --- Object storage ---
  const hasS3 = Boolean(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET);
  if (!hasS3) {
    if (isProduction) errors.push('S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_BUCKET are required.');
    else warnings.push('S3 credentials/bucket not fully set — uploads/streaming will fail until configured.');
  }

  // --- Production-only hardening ---
  if (isProduction) {
    if (env.JWT_SECRET && isWeakSecret(env.JWT_SECRET)) {
      errors.push(`JWT_SECRET is too weak — use a random string of at least ${MIN_SECRET_LENGTH} characters.`);
    }
    if (env.COOKIE_SECRET && isWeakSecret(env.COOKIE_SECRET)) {
      errors.push(`COOKIE_SECRET is too weak — use a random string of at least ${MIN_SECRET_LENGTH} characters.`);
    }
    if (env.JWT_SECRET && env.COOKIE_SECRET && env.JWT_SECRET === env.COOKIE_SECRET) {
      errors.push('JWT_SECRET and COOKIE_SECRET must be different values.');
    }
    if (!env.FRONTEND_ORIGIN) {
      errors.push('FRONTEND_ORIGIN is required in production (CORS + CSRF origin allowlist).');
    }
    if (!env.S3_PUBLIC_ENDPOINT) {
      errors.push('S3_PUBLIC_ENDPOINT is required in production for browser-reachable signed upload/stream URLs.');
    }
    if (env.S3_SECRET_ACCESS_KEY && WEAK_SECRET_VALUES.has(String(env.S3_SECRET_ACCESS_KEY).toLowerCase())) {
      errors.push('S3_SECRET_ACCESS_KEY uses a default/weak value — set real object-storage credentials.');
    }
    if (env.S3_IS_PUBLIC === 'true') {
      warnings.push('S3_IS_PUBLIC=true exposes objects publicly — ensure this is intentional. NoirSound serves audio via signed URLs.');
    }
  } else {
    if (env.NODE_ENV !== 'test') {
      warnings.push('NODE_ENV is not "production" — secret-strength checks are relaxed.');
    }
  }

  return { errors, warnings, isProduction };
}

/** Resolve the allowed browser origins (CORS + CSRF). */
function getAllowedOrigins(env = {}) {
  const raw = env.FRONTEND_ORIGIN || 'http://localhost:5173';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Validate the live process env. Logs warnings; throws on errors.
 * @param {object} [opts]
 * @param {object} [opts.env]
 * @param {(msg: string) => void} [opts.logger]
 */
function loadAndValidateConfig({ env = process.env, logger = console } = {}) {
  const { errors, warnings, isProduction } = evaluateConfig(env);
  for (const w of warnings) {
    if (logger.warn) logger.warn(`[config] ${w}`);
  }
  if (errors.length > 0) {
    const message = `Invalid configuration:\n  - ${errors.join('\n  - ')}`;
    throw new Error(message);
  }
  return {
    isProduction,
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 3000),
    allowedOrigins: getAllowedOrigins(env),
    hasRedis: Boolean(env.REDIS_URL || env.REDIS_HOST),
    trustProxy: env.TRUST_PROXY === 'true' || isProduction
  };
}

/** Redaction-safe summary of config for startup logs (no secret values). */
function safeConfigSummary(env = process.env) {
  const present = (k) => (env[k] ? 'set' : 'MISSING');
  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 3000),
    frontendOrigin: getAllowedOrigins(env),
    database: present('DATABASE_URL'),
    redis: env.REDIS_URL || env.REDIS_HOST ? 'set' : 'MISSING',
    s3Endpoint: env.S3_ENDPOINT || 'default(localhost:9000)',
    s3PublicEndpoint: env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT || 'default(localhost:9000)',
    s3Bucket: env.S3_BUCKET || 'default(noirsound-audio)',
    jwtSecret: present('JWT_SECRET'),
    cookieSecret: present('COOKIE_SECRET')
  };
}

module.exports = {
  MIN_SECRET_LENGTH,
  isWeakSecret,
  evaluateConfig,
  getAllowedOrigins,
  loadAndValidateConfig,
  safeConfigSummary
};
