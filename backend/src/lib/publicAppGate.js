'use strict';

const fp = require('fastify-plugin');
const jwt = require('jsonwebtoken');

const PUBLIC_API_PREFIXES = [
  '/api/ready',
  '/api/health',
  '/api/auth',
  '/api/tracks/showcase',
  '/api/landing'
];

function isPublicRoute(url) {
  const path = url.split('?')[0];
  if (!path.startsWith('/api')) {
    return true;
  }
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
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
    if (path.startsWith('/api/admin')) {
      return;
    }

    // For any other application API, check if an admin is accessing it (Admin Bypass)
    let isAdmin = false;
    if (request.user && (request.user.role === 'ADMIN' || request.user.role === 'SUPERADMIN')) {
      isAdmin = true;
    } else if (request.cookies && request.cookies.token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(request.cookies.token, process.env.JWT_SECRET);
        if (decoded && decoded.userId) {
          const user = await fastify.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, role: true, status: true }
          });
          if (user && user.status === 'ACTIVE' && (user.role === 'ADMIN' || user.role === 'SUPERADMIN')) {
            isAdmin = true;
            if (!request.user) {
              request.user = user;
            }
          }
        }
      } catch {
        // Token verification failed; treated as unauthenticated
      }
    }

    if (isAdmin) {
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
