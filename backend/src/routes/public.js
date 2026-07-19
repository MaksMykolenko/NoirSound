'use strict';

const { optionalAuthenticatedUserId } = require('../lib/optionalAuth');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');
const {
  BANNER_MIME_TYPES,
  MAX_BANNER_BYTES,
  bannerKeyFromUploadId,
  legacyBannerKeyFromUploadId
} = require('../lib/profileMedia');

/**
 * Public, no-auth media routes used by social/OG previews.
 *
 * Registered under the `/api/public` prefix. These never require authentication
 * and never expose private storage object keys or presigned MinIO URLs.
 */
module.exports = async function publicRoutes(fastify) {
  fastify.get('/profile-banners/:userId/:uploadId', {
    config: {
      rateLimit: {
        max: scaledRateLimitMax(120),
        timeWindow: '1 minute',
        keyGenerator: userOrIpKey
      }
    }
  }, async (request, reply) => {
    const { userId, uploadId } = request.params;
    const candidateKeys = [
      bannerKeyFromUploadId(userId, uploadId),
      legacyBannerKeyFromUploadId(userId, uploadId)
    ].filter(Boolean);
    if (candidateKeys.length === 0) return reply.notFound('Profile banner not found.');

    try {
      const owner = await fastify.prisma.user.findFirst({
        where: { id: userId, status: 'ACTIVE', bannerUrl: { in: candidateKeys } },
        select: { id: true, bannerUrl: true }
      });
      if (!owner) return reply.notFound('Profile banner not found.');
      const bannerKey = owner.bannerUrl;

      const metadata = await fastify.storage.getObjectMetadata(bannerKey);
      const mimeType = String(metadata?.mimeType || '').toLowerCase();
      if (
        !metadata?.exists
        || !BANNER_MIME_TYPES.has(mimeType)
        || !Number.isFinite(Number(metadata.size))
        || Number(metadata.size) <= 0
        || Number(metadata.size) > MAX_BANNER_BYTES
      ) {
        return reply.notFound('Profile banner not found.');
      }

      const stream = await fastify.storage.getObjectStream(bannerKey);
      reply.header('content-type', mimeType);
      reply.header('cache-control', 'public, max-age=300');
      return reply.send(stream);
    } catch (err) {
      fastify.log.error({ err, userId }, 'public profile banner: stream failed');
      return reply.notFound('Profile banner not found.');
    }
  });

  fastify.get('/playlist-covers/:playlistId', async (request, reply) => {
    const fallback = () => reply.redirect('/og/default-track.png', 302);
    try {
      const viewerId = await optionalAuthenticatedUserId(fastify, request);
      const playlist = await fastify.prisma.playlist.findFirst({
        where: {
          id: request.params.playlistId,
          OR: [
            { isPublic: true },
            ...(viewerId ? [{ creatorId: viewerId }] : [])
          ]
        },
        select: { coverImageKey: true, coverUrl: true }
      });
      if (!playlist) return fallback();
      if (playlist.coverUrl && /^https?:\/\//i.test(playlist.coverUrl)) {
        return reply.redirect(playlist.coverUrl, 302);
      }
      if (playlist.coverUrl?.startsWith('/')) return reply.redirect(playlist.coverUrl, 302);
      if (!playlist.coverImageKey) return fallback();
      const meta = await fastify.storage.getObjectMetadata(playlist.coverImageKey);
      if (!meta?.exists) return fallback();
      const stream = await fastify.storage.getObjectStream(playlist.coverImageKey);
      reply.header('content-type', meta.mimeType || 'image/jpeg');
      reply.header('cache-control', 'public, max-age=86400');
      return reply.send(stream);
    } catch (err) {
      fastify.log.error({ err }, 'public playlist cover: stream failed');
      return fallback();
    }
  });

  // Controlled cover image for a published track. Used as the og:image for
  // /track/:id previews. Streams the bytes through the backend so the private
  // storage key/endpoint is never revealed; falls back to the default OG image.
  fastify.get('/covers/:trackId', async (request, reply) => {
    const fallback = () => reply.redirect('/og/default-track.png', 302);

    let track;
    try {
      track = await fastify.prisma.track.findFirst({
        where: {
          id: request.params.trackId,
          status: 'PUBLISHED',
          isPublic: true,
          artist: { isHidden: false, user: { status: 'ACTIVE' } }
        },
        select: { coverImageKey: true, coverUrl: true }
      });
    } catch (err) {
      fastify.log.error({ err }, 'public cover: lookup failed');
      return fallback();
    }

    // Not found, not published, or owned by a suspended/banned/deleted artist.
    if (!track) return fallback();

    // A public/external cover URL (e.g. seed data or an absolute https URL) is
    // safe to hand back directly without touching private storage.
    if (track.coverUrl && /^https?:\/\//i.test(track.coverUrl)) {
      return reply.redirect(track.coverUrl, 302);
    }
    if (track.coverUrl && track.coverUrl.startsWith('/')) {
      return reply.redirect(track.coverUrl, 302);
    }

    if (!track.coverImageKey) return fallback();

    try {
      const meta = await fastify.storage.getObjectMetadata(track.coverImageKey);
      if (!meta || !meta.exists) return fallback();
      const stream = await fastify.storage.getObjectStream(track.coverImageKey);
      reply.header('content-type', meta.mimeType || 'image/jpeg');
      reply.header('cache-control', 'public, max-age=86400');
      return reply.send(stream);
    } catch (err) {
      fastify.log.error({ err }, 'public cover: stream failed');
      return fallback();
    }
  });
};
