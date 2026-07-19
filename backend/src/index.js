require('dotenv').config();
const {
  loadAndValidateConfig,
  safeConfigSummary,
  getAllowedOrigins
} = require('./config');
const {
  PROFILE_BANNER_ORPHAN_GRACE_MS,
  cleanupOrphanedProfileBanners
} = require('./lib/profileMedia');

const PROFILE_BANNER_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Build a Redis client for the rate limiter (production / when configured).
// Returns null when Redis is not configured or in test, in which case the
// limiter transparently falls back to an in-memory (per-instance) store.
function buildRateLimitRedis() {
  if (process.env.NODE_ENV === 'test') return null;
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) return null;
  try {
    const Redis = require('ioredis');
    const client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: true, connectionName: 'noirsound-ratelimit' })
      : new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT || 6379),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
        connectionName: 'noirsound-ratelimit'
      });
    client.on('error', () => { /* logged at app level; limiter degrades gracefully */ });
    return client;
  } catch {
    return null;
  }
}

function buildServer(options = {}) {
  const fastify = require('fastify')({
    logger: process.env.NODE_ENV !== 'test'
      ? { level: process.env.LOG_LEVEL || 'info' }
      : false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production'
  });

  const cors = require('@fastify/cors');
  const sensible = require('@fastify/sensible');
  const storage = options.storage || require('./services/storage');
  const ownsAudioQueue = !options.audioQueue;
  const audioQueue = options.audioQueue || require('./services/audioQueue').createAudioQueue();
  const rateLimitRedis = options.rateLimitRedis !== undefined ? options.rateLimitRedis : buildRateLimitRedis();

  // CORS — credentialed, restricted to the configured origin allowlist.
  fastify.register(cors, {
    origin: getAllowedOrigins(process.env),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });
  fastify.register(sensible);

  // Rate limiting — Redis-backed when available, in-memory fallback otherwise.
  fastify.register(require('@fastify/rate-limit'), {
    global: false,
    redis: rateLimitRedis || undefined,
    errorResponseBuilder: function (request, context) {
      return {
        statusCode: 429,
        error: 'RATE_LIMITED',
        message: 'Too many attempts. Please try again later.',
        retryAfter: context.after
      };
    }
  });

  fastify.register(require('./plugins/prisma'), { client: options.prisma });
  fastify.register(require('./plugins/auth'));
  fastify.register(require('./plugins/csrf'));
  fastify.decorate('storage', storage);
  fastify.decorate('audioQueue', audioQueue);

  let profileBannerSweepTimer = null;
  fastify.addHook('onReady', async () => {
    if (typeof storage.listObjectsByPrefix !== 'function') return;
    const sweep = async () => {
      try {
        const result = await cleanupOrphanedProfileBanners({
          prisma: fastify.prisma,
          storage,
          graceMs: PROFILE_BANNER_ORPHAN_GRACE_MS,
          logger: fastify.log
        });
        if (result.deleted > 0) {
          fastify.log.info(result, 'Orphaned profile banners removed');
        }
      } catch (error) {
        fastify.log.warn({ err: error }, 'Orphaned profile banner sweep failed');
      }
    };
    await sweep();
    profileBannerSweepTimer = setInterval(sweep, PROFILE_BANNER_SWEEP_INTERVAL_MS);
    profileBannerSweepTimer.unref?.();
  });
  fastify.addHook('onClose', async () => {
    if (profileBannerSweepTimer) clearInterval(profileBannerSweepTimer);
  });

  // Security headers on every response (helmet-equivalent, no extra dep).
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    // The JSON API locks the CSP right down. The server-rendered SPA shell
    // (text/html from the metadata routes) must load its own scripts/styles/
    // fonts, so the API CSP is not applied there — matching how Caddy already
    // serves the static SPA (no CSP). Crawlers only read <head> metadata.
    const responseContentType = String(reply.getHeader('content-type') || '');
    if (!responseContentType.includes('text/html')) {
      reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    return payload;
  });

  if (ownsAudioQueue) {
    audioQueue.on('error', (error) => {
      fastify.log.error({ err: error }, 'Audio queue connection error');
    });
    fastify.addHook('onClose', async () => {
      await audioQueue.close();
    });
  }
  if (rateLimitRedis) {
    fastify.addHook('onReady', async () => {
      try {
        if (rateLimitRedis.status === 'wait') {
          await rateLimitRedis.connect();
        }
      } catch (error) {
        fastify.log.warn({ err: error }, 'Rate-limit Redis connection is unavailable');
      }
    });
    fastify.addHook('onClose', async () => {
      try { await rateLimitRedis.quit(); } catch { /* noop */ }
    });
  }

  // Register routes
  fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
  fastify.register(require('./routes/googleAuth'), {
    prefix: '/api/auth',
    googleOAuthClientFactory: options.googleOAuthClientFactory
  });
  fastify.register(require('./routes/tracks'), { prefix: '/api/tracks' });
  fastify.register(require('./routes/artists'), { prefix: '/api/artists' });
  fastify.register(require('./routes/profiles'), { prefix: '/api/profiles' });
  fastify.register(require('./routes/playlists'), { prefix: '/api/playlists' });
  fastify.register(require('./routes/uploads'), { prefix: '/api/uploads' });
  fastify.register(require('./routes/uploadBatches'), { prefix: '/api/uploads/batch' });
  fastify.register(require('./routes/comments'), { prefix: '/api/comments' });
  fastify.register(require('./routes/reports'), { prefix: '/api/reports' });
  fastify.register(require('./routes/admin'), { prefix: '/api/admin' });
  fastify.register(require('./routes/stats'), { prefix: '/api' });
  // Public, no-auth media (OG cover previews — never exposes private keys).
  fastify.register(require('./routes/public'), { prefix: '/api/public' });
  // Server-rendered metadata for crawler-visible routes (/, /track/:id,
  // /artist/:id, legal pages) and the dynamic sitemap. Registered at root;
  // Caddy proxies only these document paths to the backend.
  fastify.register(require('./routes/pages'));

  // Liveness — process is up.
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Runtime mode check for deployment smoke tests. This never exposes secrets.
  fastify.get('/api/mode', async () => {
    return {
      apiMode: 'real',
      mock: false,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'non-production'
    };
  });

  // Readiness — dependencies reachable.
  fastify.get('/api/ready', async (request, reply) => {
    const checks = { database: 'unknown', redis: 'unknown', storage: 'unknown' };
    let ready = true;

    try {
      if (fastify.prisma && fastify.prisma.$queryRaw) {
        await fastify.prisma.$queryRaw`SELECT 1`;
        checks.database = 'ok';
      } else {
        checks.database = 'unavailable';
        ready = false;
      }
    } catch {
      checks.database = 'error';
      ready = false;
    }

    if (rateLimitRedis) {
      try {
        await rateLimitRedis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'error';
        ready = false;
      }
    } else {
      checks.redis = 'not-configured';
    }

    if (storage && typeof storage.checkHealth === 'function') {
      try {
        await storage.checkHealth();
        checks.storage = 'ok';
      } catch {
        checks.storage = 'error';
        ready = false;
      }
    } else {
      checks.storage = 'unavailable';
      ready = false;
    }

    return reply.status(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'not-ready',
      checks,
      timestamp: new Date().toISOString()
    });
  });

  return fastify;
}

const start = async () => {
  // Refuse to boot in production with missing/weak secrets.
  let config;
  try {
    config = loadAndValidateConfig();
  } catch (err) {
    console.error('[startup] ' + err.message);
    process.exit(1);
  }

  const fastify = buildServer();
  fastify.log.info({ config: safeConfigSummary() }, 'NoirSound backend starting');
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = buildServer;
