'use strict';

const { resolveAuthenticatedSession } = require('./sessionResolver');

async function optionalAuthenticatedUserId(fastify, request) {
  const resolved = await resolveAuthenticatedSession(fastify, request);
  return resolved?.user.id || null;
}

module.exports = { optionalAuthenticatedUserId };
