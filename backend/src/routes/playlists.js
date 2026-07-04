const { serializePublicTrack } = require('../lib/publicTrack');
const { serializePublicPlaylist } = require('../lib/publicPlaylist');
const { optionalAuthenticatedUserId } = require('../lib/optionalAuth');

async function playlistsRoutes(fastify, _options) {
  // GET /api/playlists
  fastify.get('/', async (request, reply) => {
    try {
      const playlists = await fastify.prisma.playlist.findMany({
        where: { isPublic: true },
        include: { creator: { select: { displayName: true } } }
      });
      return { data: playlists.map(serializePublicPlaylist) };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/playlists/:id
  fastify.get('/:id', async (request, reply) => {
    try {
      const viewerId = await optionalAuthenticatedUserId(fastify, request);
      const playlist = await fastify.prisma.playlist.findFirst({
        where: {
          id: request.params.id,
          OR: [
            { isPublic: true },
            ...(viewerId ? [{ creatorId: viewerId }] : [])
          ]
        },
        include: { 
          creator: { select: { displayName: true } },
          tracks: {
            where: {
              track: {
                status: 'PUBLISHED',
                ...(viewerId ? {
                  OR: [
                    { isPublic: true },
                    { artist: { userId: viewerId } }
                  ]
                } : { isPublic: true }),
                artist: { isHidden: false, user: { status: 'ACTIVE' } }
              }
            },
            include: {
              track: {
                include: {
                  artist: {
                    include: {
                      user: {
                        select: {
                          displayName: true,
                          username: true,
                          avatarUrl: true
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { order: 'asc' }
          }
        }
      });
      if (!playlist) {
        return reply.status(404).send({ error: 'Playlist not found' });
      }
      return {
        playlist: {
          ...serializePublicPlaylist(playlist),
          tracks: playlist.tracks.map((entry) => ({
            ...entry,
            track: serializePublicTrack(entry.track)
          }))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/playlists/me
  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      const playlists = await fastify.prisma.playlist.findMany({
        where: { creatorId: request.user.id },
        orderBy: { createdAt: 'desc' },
        include: { creator: { select: { displayName: true, username: true } } }
      });
      return { data: playlists.map(serializePublicPlaylist) };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/playlists
  fastify.post('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { name, description, isPublic } = request.body;
    try {
      const playlist = await fastify.prisma.playlist.create({
        data: {
          name,
          description,
          isPublic: isPublic !== undefined ? isPublic : true,
          creatorId: request.user.id
        },
        include: { creator: { select: { displayName: true, username: true } } }
      });
      return { playlist: serializePublicPlaylist(playlist) };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = playlistsRoutes;
