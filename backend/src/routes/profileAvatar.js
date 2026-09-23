'use strict';

const { randomUUID } = require('node:crypto');
const { MAX_IMAGE_BYTES, IMAGE_TYPES, optimizeImage } = require('../services/images');
const { signatureMatchesDeclared } = require('../lib/fileSignature');
const { avatarUrl, avatarKey, ownedAvatarKey } = require('../lib/avatarMedia');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');

module.exports = async function profileAvatarRoutes(fastify, { serializeUser }) {
  fastify.addContentTypeParser([...IMAGE_TYPES], { parseAs: 'buffer', bodyLimit: MAX_IMAGE_BYTES },
    (_request, body, done) => done(null, body));

  fastify.post('/me/avatar', {
    bodyLimit: MAX_IMAGE_BYTES,
    preValidation: [fastify.authenticate],
    config: { rateLimit: { max: scaledRateLimitMax(20), timeWindow: '1 hour', keyGenerator: userOrIpKey } },
  }, async (request, reply) => {
    const mime = request.headers['content-type']?.split(';')[0].trim().toLowerCase();
    if (!Buffer.isBuffer(request.body) || !IMAGE_TYPES.has(mime)
      || !signatureMatchesDeclared(mime, request.body)) {
      return reply.code(400).send({ error: 'PROFILE_AVATAR_INVALID', message: 'Choose a valid JPEG, PNG, or WebP image.' });
    }
    let image;
    try {
      image = await optimizeImage(request.body, 512);
    } catch (error) {
      return reply.code(error.statusCode || 400).send({
        error: error.statusCode === 503 ? 'PROFILE_AVATAR_BUSY' : 'PROFILE_AVATAR_INVALID',
        message: error.statusCode === 503 ? error.message : 'This image could not be read. Choose another JPEG, PNG, or WebP image.',
      });
    }
    const uploadId = `${randomUUID()}.webp`;
    const key = avatarKey(request.user.id, uploadId);
    const url = avatarUrl(request.user.id, uploadId);
    try {
      await fastify.storage.putObject(key, image, 'image/webp');
      const user = await fastify.prisma.user.update({
        where: { id: request.user.id }, data: { avatarUrl: url },
      });
      // Only managed objects owned by this account can be removed. Each upload
      // gets a new URL, so no later request can reactivate this previous object.
      const previousKey = ownedAvatarKey(request.user.avatarUrl, request.user.id);
      if (previousKey) {
        try { await fastify.storage.deleteObject(previousKey); }
        catch { fastify.log.warn('Previous avatar cleanup deferred'); }
      }
      return { user: await serializeUser(user) };
    } catch (error) {
      // Preserve the candidate on an ambiguous database failure; never delete
      // bytes that an update may already have activated.
      fastify.log.error({ err: error }, 'Avatar upload failed');
      return reply.code(502).send({ error: 'PROFILE_AVATAR_UPLOAD_FAILED', message: 'Avatar could not be saved. Please try again.' });
    }
  });
};
