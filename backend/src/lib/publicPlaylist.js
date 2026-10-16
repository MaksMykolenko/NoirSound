'use strict';

function serializePublicPlaylist(playlist) {
  if (!playlist) return null;
  const {
    coverImageKey,
    sourceBatch: _sourceBatch,
    sourceImport: _sourceImport,
    ...safePlaylist
  } = playlist;
  return {
    ...safePlaylist,
    hasCoverImage: Boolean(coverImageKey)
  };
}

module.exports = { serializePublicPlaylist };
