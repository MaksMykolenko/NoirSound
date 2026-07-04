'use strict';

const { optionalAuthenticatedUserId } = require('../lib/optionalAuth');

/**
 * Public, no-auth media routes used by social/OG previews.
 *
 * Registered under the `/api/public` prefix. These never require authentication
 * and never expose private storage object keys or presigned MinIO URLs.
 */
module.exports = async function publicRoutes(fastify) {
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
