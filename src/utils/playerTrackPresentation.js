export const playerTrackHref = track => track.importedPlaylistId ? `/playlist/${track.importedPlaylistId}` : track.previewExternalId ? '/external-music' : `/track/${track.id}`;
export const playerArtistLabel = track => track?.artistName;
