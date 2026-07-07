'use strict';

const { serializePublicTrack } = require('../lib/publicTrack');
const { optionalAuthenticatedUserId } = require('../lib/optionalAuth');
const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_PLAYLIST_TRACKS = 1000;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const creatorSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  artistProfile: { select: { id: true } }
};

const trackInclude = {
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
};

function apiError(reply, status, error, message) {
  return reply.status(status).send({ error, message });
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function playlistPermissions(playlist, viewer) {
  const isOwner = Boolean(viewer && playlist.creatorId === viewer.id);
  const isAdmin = viewer?.role === 'ADMIN';
  return {
    isOwner,
    isSaved: Boolean(playlist.likedBy?.length),
    canEdit: isOwner || isAdmin,
    canDelete: isOwner || isAdmin,
    canReorder: isOwner || isAdmin
  };
}

function serializePlaylist(playlist, viewer, { includeTracks = false } = {}) {
  const trackRows = includeTracks
    ? (playlist.tracks || []).map((entry) => ({
        id: `${entry.playlistId}:${entry.trackId}`,
        playlistId: entry.playlistId,
        trackId: entry.trackId,
        position: entry.order,
        order: entry.order,
        addedAt: entry.addedAt,
        track: serializePublicTrack(entry.track)
      }))
    : undefined;
  const trackCount = Number(playlist._count?.tracks ?? trackRows?.length ?? 0);
  const durationSeconds = trackRows
    ? trackRows.reduce(
        (total, entry) => total + Number(entry.track.durationSeconds || entry.track.duration || 0),
        0
      )
    : undefined;

  return {
    id: playlist.id,
    name: playlist.name,
    title: playlist.name,
    description: playlist.description || '',
    coverUrl: playlist.coverUrl || null,
    hasCoverImage: Boolean(playlist.coverImageKey),
    creatorId: playlist.creatorId,
    creator: playlist.creator,
    owner: playlist.creator,
    ownerArtistId: playlist.creator?.artistProfile?.id || null,
    isPublic: playlist.isPublic,
    visibility: playlist.isPublic ? 'PUBLIC' : 'PRIVATE',
    tags: playlist.tags || [],
    likes: Number(playlist.likes || 0),
    trackCount,
    ...(durationSeconds === undefined ? {} : { durationSeconds }),
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
    ...playlistPermissions(playlist, viewer),
    ...(includeTracks ? { tracks: trackRows } : {})
  };
}

function playlistInclude(viewerId, includeTracks = false) {
  return {
    creator: { select: creatorSelect },
    _count: { select: { tracks: true } },
    ...(viewerId
      ? { likedBy: { where: { userId: viewerId }, select: { userId: true } } }
      : {}),
    ...(includeTracks
      ? {
          tracks: {
            include: { track: { include: trackInclude } },
            orderBy: { order: 'asc' }
          }
        }
      : {})
  };
}

async function optionalViewer(fastify, request) {
  const id = await optionalAuthenticatedUserId(fastify, request);
  if (!id) return null;
  return fastify.prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true }
  });
}

async function ownedPlaylist(fastify, id, user, includeTracks = false) {
  const playlist = await fastify.prisma.playlist.findUnique({
    where: { id },
    include: playlistInclude(user.id, includeTracks)
  });
  if (!playlist) return { error: 'PLAYLIST_NOT_FOUND', status: 404 };
  if (playlist.creatorId !== user.id && user.role !== 'ADMIN') {
    return { error: 'PLAYLIST_FORBIDDEN', status: 403 };
  }
  return { playlist };
}

async function playlistsRoutes(fastify) {
  const mutationOptions = {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: {
        max: scaledRateLimitMax(60),
        timeWindow: '10 minutes',
        keyGenerator: userOrIpKey
      }
    }
  };

  fastify.get('/', async (request, reply) => {
    try {
      const viewer = await optionalViewer(fastify, request);
      const playlists = await fastify.prisma.playlist.findMany({
        where: { isPublic: true },
        orderBy: { updatedAt: 'desc' },
        include: playlistInclude(viewer?.id)
      });
      return { data: playlists.map((playlist) => serializePlaylist(playlist, viewer)) };
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLISTS_UNAVAILABLE', 'Playlists could not be loaded.');
    }
  });

  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      const playlists = await fastify.prisma.playlist.findMany({
        where: {
          OR: [
            { creatorId: request.user.id },
            { isPublic: true, likedBy: { some: { userId: request.user.id } } }
          ]
        },
        orderBy: { updatedAt: 'desc' },
        include: playlistInclude(request.user.id)
      });
      return { data: playlists.map((playlist) => serializePlaylist(playlist, request.user)) };
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLISTS_UNAVAILABLE', 'Your playlists could not be loaded.');
    }
  });

  fastify.post('/', mutationOptions, async (request, reply) => {
    const name = cleanText(request.body?.name ?? request.body?.title);
    const description = cleanText(request.body?.description);
    if (!name) {
      return apiError(reply, 400, 'PLAYLIST_TITLE_REQUIRED', 'Playlist title is required.');
    }
    if (name.length > MAX_TITLE_LENGTH) {
      return apiError(reply, 400, 'PLAYLIST_TITLE_INVALID', `Playlist title must be at most ${MAX_TITLE_LENGTH} characters.`);
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return apiError(reply, 400, 'PLAYLIST_DESCRIPTION_INVALID', `Playlist description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`);
    }
    try {
      const playlist = await fastify.prisma.playlist.create({
        data: {
          name,
          description: description || null,
          isPublic: request.body?.isPublic !== false,
          creatorId: request.user.id
        },
        include: playlistInclude(request.user.id)
      });
      return reply.status(201).send({ playlist: serializePlaylist(playlist, request.user) });
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLIST_CREATE_FAILED', 'Playlist could not be created.');
    }
  });

  fastify.get('/:id', async (request, reply) => {
    try {
      const viewer = await optionalViewer(fastify, request);
      const playlist = await fastify.prisma.playlist.findUnique({
        where: { id: request.params.id },
        include: playlistInclude(viewer?.id, true)
      });
      if (!playlist) {
        return apiError(reply, 404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
      }
      if (!playlist.isPublic && playlist.creatorId !== viewer?.id && viewer?.role !== 'ADMIN') {
        return apiError(reply, viewer ? 403 : 404, 'PLAYLIST_PRIVATE', 'This playlist is private.');
      }
      return { playlist: serializePlaylist(playlist, viewer, { includeTracks: true }) };
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLISTS_UNAVAILABLE', 'Playlist could not be loaded.');
    }
  });

  fastify.patch('/:id', mutationOptions, async (request, reply) => {
    const access = await ownedPlaylist(fastify, request.params.id, request.user);
    if (access.error) return apiError(reply, access.status, access.error, 'Playlist cannot be edited.');

    const updates = {};
    if (request.body?.name !== undefined || request.body?.title !== undefined) {
      const name = cleanText(request.body.name ?? request.body.title);
      if (!name) return apiError(reply, 400, 'PLAYLIST_TITLE_REQUIRED', 'Playlist title is required.');
      if (name.length > MAX_TITLE_LENGTH) {
        return apiError(reply, 400, 'PLAYLIST_TITLE_INVALID', `Playlist title must be at most ${MAX_TITLE_LENGTH} characters.`);
      }
      updates.name = name;
    }
    if (request.body?.description !== undefined) {
      const description = cleanText(request.body.description);
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        return apiError(reply, 400, 'PLAYLIST_DESCRIPTION_INVALID', `Playlist description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`);
      }
      updates.description = description || null;
    }
    if (request.body?.isPublic !== undefined) updates.isPublic = request.body.isPublic === true;
    if (request.body?.coverUrl !== undefined) {
      const coverUrl = cleanText(request.body.coverUrl);
      if (coverUrl && coverUrl.length > 500) {
        return apiError(reply, 400, 'PLAYLIST_COVER_INVALID', 'Playlist cover URL is too long.');
      }
      updates.coverUrl = coverUrl || null;
      if (coverUrl) updates.coverImageKey = null;
    }

    try {
      const playlist = await fastify.prisma.playlist.update({
        where: { id: request.params.id },
        data: updates,
        include: playlistInclude(request.user.id)
      });
      return { playlist: serializePlaylist(playlist, request.user) };
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLIST_UPDATE_FAILED', 'Playlist could not be updated.');
    }
  });

  fastify.delete('/:id', mutationOptions, async (request, reply) => {
    const access = await ownedPlaylist(fastify, request.params.id, request.user);
    if (access.error) return apiError(reply, access.status, access.error, 'Playlist cannot be deleted.');
    try {
      await fastify.prisma.playlist.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLIST_DELETE_FAILED', 'Playlist could not be deleted.');
    }
  });

  fastify.post('/:id/tracks', mutationOptions, async (request, reply) => {
    const trackId = cleanText(request.body?.trackId);
    if (!trackId) {
      return apiError(reply, 400, 'PLAYLIST_TRACK_NOT_FOUND', 'Track is required.');
    }
    const access = await ownedPlaylist(fastify, request.params.id, request.user, true);
    if (access.error) return apiError(reply, access.status, access.error, 'Track cannot be added.');
    if (access.playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
      return apiError(reply, 409, 'PLAYLIST_LIMIT_REACHED', `A playlist can contain at most ${MAX_PLAYLIST_TRACKS} tracks.`);
    }
    if (access.playlist.tracks.some((entry) => entry.trackId === trackId)) {
      return apiError(reply, 409, 'PLAYLIST_TRACK_ALREADY_EXISTS', 'Track is already in this playlist.');
    }

    const track = await fastify.prisma.track.findFirst({
      where: {
        id: trackId,
        status: 'PUBLISHED',
        isPublic: true,
        processedAudioKey: { not: null },
        artist: { isHidden: false, user: { status: 'ACTIVE' } }
      },
      include: trackInclude
    });
    if (!track) {
      return apiError(reply, 404, 'PLAYLIST_TRACK_NOT_FOUND', 'Track is unavailable.');
    }
    try {
      const order = access.playlist.tracks.reduce(
        (highest, entry) => Math.max(highest, entry.order),
        0
      ) + 1;
      const entry = await fastify.prisma.playlistTrack.create({
        data: { playlistId: access.playlist.id, trackId, order },
        include: { track: { include: trackInclude } }
      });
      return reply.status(201).send({
        entry: {
          playlistId: entry.playlistId,
          trackId: entry.trackId,
          position: entry.order,
          order: entry.order,
          addedAt: entry.addedAt,
          track: serializePublicTrack(entry.track)
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return apiError(reply, 409, 'PLAYLIST_TRACK_ALREADY_EXISTS', 'Track is already in this playlist.');
      }
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLIST_TRACK_ADD_FAILED', 'Track could not be added.');
    }
  });

  fastify.delete('/:id/tracks/:trackId', mutationOptions, async (request, reply) => {
    const access = await ownedPlaylist(fastify, request.params.id, request.user, true);
    if (access.error) return apiError(reply, access.status, access.error, 'Track cannot be removed.');
    const entry = access.playlist.tracks.find((item) => item.trackId === request.params.trackId);
    if (!entry) return apiError(reply, 404, 'PLAYLIST_TRACK_NOT_FOUND', 'Track is not in this playlist.');
    try {
      await fastify.prisma.$transaction([
        fastify.prisma.playlistTrack.delete({
          where: {
            playlistId_trackId: {
              playlistId: access.playlist.id,
              trackId: request.params.trackId
            }
          }
        }),
        ...access.playlist.tracks
          .filter((item) => item.trackId !== request.params.trackId)
          .sort((a, b) => a.order - b.order)
          .map((item, index) => fastify.prisma.playlistTrack.update({
            where: {
              playlistId_trackId: {
                playlistId: access.playlist.id,
                trackId: item.trackId
              }
            },
            data: { order: index + 1 }
          }))
      ]);
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLIST_TRACK_REMOVE_FAILED', 'Track could not be removed.');
    }
  });

  fastify.patch('/:id/tracks/reorder', mutationOptions, async (request, reply) => {
    const access = await ownedPlaylist(fastify, request.params.id, request.user, true);
    if (access.error) return apiError(reply, access.status, access.error, 'Playlist cannot be reordered.');
    const trackIds = request.body?.trackIds;
    const currentIds = access.playlist.tracks.map((entry) => entry.trackId);
    if (
      !Array.isArray(trackIds)
      || trackIds.length !== currentIds.length
      || new Set(trackIds).size !== trackIds.length
      || trackIds.some((id) => !currentIds.includes(id))
    ) {
      return apiError(reply, 400, 'PLAYLIST_REORDER_INVALID', 'Reorder payload must contain every playlist track exactly once.');
    }
    try {
      await fastify.prisma.$transaction(trackIds.map((trackId, index) =>
        fastify.prisma.playlistTrack.update({
          where: {
            playlistId_trackId: {
              playlistId: access.playlist.id,
              trackId
            }
          },
          data: { order: index + 1 }
        })
      ));
      return { success: true, trackIds };
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLIST_REORDER_INVALID', 'Playlist order could not be saved.');
    }
  });

  fastify.post('/:id/save', mutationOptions, async (request, reply) => {
    const playlist = await fastify.prisma.playlist.findUnique({ where: { id: request.params.id } });
    if (!playlist) return apiError(reply, 404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
    if (!playlist.isPublic && playlist.creatorId !== request.user.id) {
      return apiError(reply, 403, 'PLAYLIST_PRIVATE', 'This playlist is private.');
    }
    try {
      await fastify.prisma.$transaction([
        fastify.prisma.playlistLike.create({
          data: { userId: request.user.id, playlistId: playlist.id }
        }),
        fastify.prisma.playlist.update({
          where: { id: playlist.id },
          data: { likes: { increment: 1 } }
        })
      ]);
    } catch (error) {
      if (error.code !== 'P2002') {
        fastify.log.error(error);
        return apiError(reply, 500, 'PLAYLIST_SAVE_FAILED', 'Playlist could not be saved.');
      }
    }
    return { success: true, isSaved: true };
  });

  fastify.delete('/:id/save', mutationOptions, async (request, reply) => {
    const playlist = await fastify.prisma.playlist.findUnique({ where: { id: request.params.id } });
    if (!playlist) return apiError(reply, 404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
    try {
      await fastify.prisma.$transaction(async (transaction) => {
        const deleted = await transaction.playlistLike.deleteMany({
          where: { userId: request.user.id, playlistId: playlist.id }
        });
        if (deleted.count > 0) {
          await transaction.playlist.updateMany({
            where: { id: playlist.id, likes: { gt: 0 } },
            data: { likes: { decrement: 1 } }
          });
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 500, 'PLAYLIST_SAVE_FAILED', 'Playlist could not be removed from your library.');
    }
    return { success: true, isSaved: false };
  });

  fastify.post('/:id/cover/init', mutationOptions, async (request, reply) => {
    const access = await ownedPlaylist(fastify, request.params.id, request.user);
    if (access.error) return apiError(reply, access.status, access.error, 'Playlist cover cannot be changed.');
    const mimeType = cleanText(request.body?.mimeType).toLowerCase();
    const fileSize = Number(request.body?.fileSize || 0);
    if (!COVER_MIME_TYPES.has(mimeType) || fileSize <= 0 || fileSize > MAX_COVER_BYTES) {
      return apiError(reply, 400, 'PLAYLIST_COVER_INVALID', 'Cover must be a JPEG, PNG, or WebP image no larger than 5MB.');
    }
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
    const coverKey = `playlists/${access.playlist.creatorId}/${access.playlist.id}/cover_${Date.now()}.${extension}`;
    try {
      const uploadUrl = await fastify.storage.createPresignedPutUrl(coverKey, mimeType);
      return { coverKey, uploadUrl, maxBytes: MAX_COVER_BYTES };
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 502, 'PLAYLIST_COVER_UPLOAD_FAILED', 'Cover upload could not be initialized.');
    }
  });

  fastify.post('/:id/cover/complete', mutationOptions, async (request, reply) => {
    const access = await ownedPlaylist(fastify, request.params.id, request.user);
    if (access.error) return apiError(reply, access.status, access.error, 'Playlist cover cannot be changed.');
    const coverKey = cleanText(request.body?.coverKey);
    const prefix = `playlists/${access.playlist.creatorId}/${access.playlist.id}/`;
    if (!coverKey.startsWith(prefix)) {
      return apiError(reply, 400, 'PLAYLIST_COVER_INVALID', 'Cover upload key is invalid.');
    }
    try {
      const metadata = await fastify.storage.getObjectMetadata(coverKey);
      if (
        !metadata?.exists
        || Number(metadata.size || 0) <= 0
        || Number(metadata.size || 0) > MAX_COVER_BYTES
        || !COVER_MIME_TYPES.has(String(metadata.mimeType || '').toLowerCase())
      ) {
        return apiError(reply, 400, 'PLAYLIST_COVER_INVALID', 'Uploaded cover could not be verified.');
      }
      const playlist = await fastify.prisma.playlist.update({
        where: { id: access.playlist.id },
        data: { coverImageKey: coverKey, coverUrl: null },
        include: playlistInclude(request.user.id)
      });
      return { playlist: serializePlaylist(playlist, request.user) };
    } catch (error) {
      fastify.log.error(error);
      return apiError(reply, 502, 'PLAYLIST_COVER_UPLOAD_FAILED', 'Cover upload could not be completed.');
    }
  });
}

module.exports = playlistsRoutes;
