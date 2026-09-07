'use strict';

const fp = require('fastify-plugin');
const { resolveAuthenticatedSession } = require('./sessionResolver');

// Only explicitly public resources bypass landing mode. Unknown namespace routes
// remain ordinary 404s; matching a public namespace never grants another API.
function isPublicRoute(url) {
  const path = url.split('?')[0];
  if (path !== '/api' && !path.startsWith('/api/')) return true;
  return path === '/api/ready' || path === '/api/health'
    || path === '/api/auth' || path.startsWith('/api/auth/')
    || path === '/api/tracks/showcase'
    || path === '/api/landing' || path.startsWith('/api/landing/');
}

module.exports = fp(async function publicAppGatePlugin(fastify) {
  fastify.addHook('preHandler', async (request, reply) => {
    // When PUBLIC_APP_ENABLED is not explicitly set to 'false', the gate is open.
    if (process.env.PUBLIC_APP_ENABLED !== 'false') {
      return;
    }

    // Always allow whitelisted public routes
    if (isPublicRoute(request.url)) {
      return;
    }

    // Admin routes pass through to be handled by adminGuard
    const path = request.url.split('?')[0];
    if (path === '/api/admin' || path.startsWith('/api/admin/')) {
      return;
    }

    const resolved = await resolveAuthenticatedSession(fastify, request);
    if (resolved?.user.role === 'ADMIN') {
      request.user = resolved.user;
      request.sessionId = resolved.sessionId;
      return;
    }

    return reply.status(403).send({
      statusCode: 403,
      code: 'PUBLIC_APP_NOT_ENABLED',
      error: 'Forbidden',
      message: 'NoirSound is currently in landing-only access mode. Full application access is restricted.'
    });
  });
});
