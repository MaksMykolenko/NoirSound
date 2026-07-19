'use strict';

const { serializeUserMedia } = require('../lib/profileMedia');

module.exports = async function profileRoutes(fastify) {
  fastify.get('/:username', async (request, reply) => {
    const username = typeof request.params.username === 'string'
      ? request.params.username.trim()
      : '';
    if (!username || username.length > 100) {
      return reply.status(404).send({
        error: 'PROFILE_NOT_FOUND',
        message: 'Profile not found.'
      });
    }

    try {
      const user = await fastify.prisma.user.findFirst({
        where: { username, status: 'ACTIVE' },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bannerUrl: true,
          bio: true,
          location: true,
          joinedAt: true,
          artistProfile: { select: { id: true, isHidden: true } }
        }
      });
      if (!user) {
        return reply.status(404).send({
          error: 'PROFILE_NOT_FOUND',
          message: 'Profile not found.'
        });
      }

      const { artistProfile, ...publicUser } = user;
      const serialized = await serializeUserMedia(fastify.storage, publicUser);
      const publicArtistProfile = artistProfile && !artistProfile.isHidden
        ? artistProfile
        : null;
      return {
        profile: {
          ...serialized,
          artistProfileId: publicArtistProfile?.id || null,
          isCreator: Boolean(publicArtistProfile)
        }
      };
    } catch (error) {
      fastify.log.error({ err: error, username }, 'Public profile lookup failed');
      return reply.status(500).send({
        error: 'PROFILE_UNAVAILABLE',
        message: 'Profile could not be loaded.'
      });
    }
  });
};
