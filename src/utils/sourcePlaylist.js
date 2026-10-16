export function sourcePlaylistTrack(playlist) {
  if (!playlist.sourceImport) return null;
  return {
    id: `source-playlist:${playlist.id}`,
    importedPlaylistId: playlist.id,
    position: 'playlist',
    title: playlist.name,
    provider: playlist.sourceImport.provider,
    canonicalUrl: playlist.sourceImport.sourceUrl,
    playbackMode: 'OFFICIAL_EMBED',
    isStreamable: false,
    hasLyrics: false,
  };
}
