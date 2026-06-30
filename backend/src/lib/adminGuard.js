'use strict';

const { userOrIpKey } = require('./rateLimitKeys');
const { scaledRateLimitMax } = require('./rateLimit');

function adminReadOptions(fastify) {
  return { preValidation: [fastify.authenticate, fastify.requireAdmin] };
}

function adminMutationOptions(fastify) {
  return {
    preValidation: [fastify.authenticate, fastify.requireAdmin],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(60),
        timeWindow: '10 minutes',
        keyGenerator: userOrIpKey
      }
    }
  };
}

function sendAdminError(reply, status, code, message) {
  return reply.status(status).send({ error: code, message });
}

function requiredReason(body, maxLength = 1000) {
  if (!body || typeof body.reason !== 'string') return null;
  const reason = body.reason.trim();
  if (!reason || reason.length > maxLength) return null;
  return reason;
}

module.exports = {
  adminReadOptions,
  adminMutationOptions,
  sendAdminError,
  requiredReason
};
