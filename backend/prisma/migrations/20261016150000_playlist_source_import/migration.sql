-- Private source-playlist snapshots preserve ordering and repeated tracks.
-- Existing native playlists and their membership rows remain unchanged.
ALTER TABLE "Playlist" ADD COLUMN "sourceImport" JSONB;
