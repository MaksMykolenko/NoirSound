'use strict';

const { serializePublicTrack } = require('./publicTrack');

/**
 * Playlist-detail-specific track enrichment: album/release fallback,
 * per-track availability, and safe field-stripping for tracks a given
 * viewer should not see in full. Kept as pure functions (no Prisma calls)
 * so this logic is unit-testable without a database.
 *
 * Album usage: `Album`/`Track.albumId` exist in the schema but nothing in
 * the app ever creates an Album row today. `resolveAlbumRelease` therefore
 * falls back to the playlist an UploadBatch generated when a track was
 * published as part of a multi-track release (`batchItem.target ===
 * 'PLAYLIST'`), and finally to null (meaning "Single" client-side). It
 * never invents an album page: album links are only ever produced when a
 * real album title is present, and even then the frontend does not link to
 * a non-existent album route (see PlaylistTrackTable).
 */

/**
 * Whether a track should be treated as playable/visible in a playlist
 * context. Mirrors the same PUBLISHED + isPublic + active-artist rule the
 * rest of the app already enforces for direct track access, applied here
 * per playlist row (the playlist detail route previously only checked
 * playlist-level visibility, not per-track visibility).
 */
function isTrackAvailable(track) {
  if (!track) return false;
  const artist = track.artist;
  const user = artist && artist.user;
  return (
    track.status === 'PUBLISHED'
    && track.isPublic !== false
    && Boolean(track.processedAudioKey)
    && Boolean(artist)
    && artist.isHidden !== true
    && Boolean(user)
    && user.status === 'ACTIVE'
  );
}

/**
 * Resolves the album/release fallback chain: real album -> originating
 * release playlist (if the viewer is allowed to see it) -> neither (client
 * renders "Single"). Never leaks a private release playlist's name to a
 * viewer who cannot see it.
 */
function resolveAlbumRelease(track, viewer) {
  const albumId = (track && track.albumId) || null;
  if (track && track.album && track.album.title) {
    return {
      albumTitle: track.album.title,
      albumId: albumId || track.album.id || null,
      releaseTitle: null,
      releasePlaylistId: null,
    };
  }

  const batchItem = track && track.batchItem;
  const releasePlaylist = batchItem && batchItem.target === 'PLAYLIST'
    ? batchItem.batch && batchItem.batch.playlist
    : null;

  if (releasePlaylist) {
    const viewerId = viewer && viewer.id;
    const isAdmin = Boolean(viewer && viewer.role === 'ADMIN');
    const canSeeRelease = Boolean(
      releasePlaylist.isPublic
      || (viewerId && (viewerId === releasePlaylist.creatorId || isAdmin))
    );
    if (canSeeRelease) {
      return {
        albumTitle: null,
        albumId,
        releaseTitle: releasePlaylist.name,
        releasePlaylistId: releasePlaylist.id,
      };
    }
  }

  return { albumTitle: null, albumId, releaseTitle: null, releasePlaylistId: null };
}

/**
 * Strips fields that exist on the raw Prisma row only so this module can
 * compute availability/release info server-side, and that must never reach
 * the client: `artist.user.status` (moderation state, more sensitive than
 * the already-public `artist.isHidden`), and the raw `album`/`batchItem`
 * relations (the derived albumTitle/releaseTitle are the only public
 * signal). Safe to call on any track shape; no-ops when fields are absent.
 */
function sanitizeTrackForSerialization(track) {
  if (!track) return track;
  const { album: _album, batchItem: _batchItem, artist, ...rest } = track;
  if (!artist) return { ...rest };
  const { user, ...restArtist } = artist;
  if (!user) return { ...rest, artist: restArtist };
  const { status: _status, ...safeUser } = user;
  return { ...rest, artist: { ...restArtist, user: safeUser } };
}

/**
 * Builds one playlist-row JSON entry from a raw PlaylistTrack Prisma row
 * (with track/artist/user/album/batchItem included) plus viewing context.
 *
 * `addedBy` is derived from `playlist.creator` rather than a PlaylistTrack
 * column: only the owner (or an admin) can ever add a track today
 * (`POST /:id/tracks` requires ownedPlaylist), so "added by" is always the
 * playlist owner. If collaborative playlists are introduced later, this is
 * the place a real per-row `addedById` would need to be threaded through.
 */
function buildPlaylistTrackEntry({ entry, playlist, viewer, likedTrackIds }) {
  const track = entry.track;
  const compositeId = `${entry.playlistId}:${entry.trackId}`;
  const isOwnerOrAdmin = Boolean(
    viewer && (viewer.id === playlist.creatorId || viewer.role === 'ADMIN')
  );
  const addedBy = playlist.creator
    ? {
      id: playlist.creator.id,
      username: playlist.creator.username,
      displayName: playlist.creator.displayName,
    }
    : null;

  const base = {
    id: compositeId,
    playlistTrackId: compositeId,
    playlistId: entry.playlistId,
    trackId: entry.trackId,
    position: entry.order,
    order: entry.order,
    addedAt: entry.addedAt,
    addedBy,
  };

  const available = isTrackAvailable(track);

  // Public/non-owner viewers get nothing beyond "this row exists and is
  // unavailable" for a track that shouldn't be shown to them -- no title,
  // artist, cover, duration, or genre. Owners/admins keep full data (with
  // isAvailable: false) so they can identify and remove it.
  if (!available && !isOwnerOrAdmin) {
    return {
      ...base,
      track: {
        id: track ? track.id : entry.trackId,
        isAvailable: false,
      },
    };
  }

  const release = resolveAlbumRelease(track, viewer);
  const isLiked = Boolean(track && likedTrackIds && likedTrackIds.has(track.id));
  const safeTrack = serializePublicTrack(sanitizeTrackForSerialization(track));

  return {
    ...base,
    track: {
      ...safeTrack,
      ...release,
      isAvailable: available,
      isLiked,
    },
  };
}

module.exports = {
  isTrackAvailable,
  resolveAlbumRelease,
  sanitizeTrackForSerialization,
  buildPlaylistTrackEntry,
};
