export const playerTrackHref = track => track.previewExternalId ? '/external-music' : `/track/${track.id}`;
export const playerArtistLabel = track => track?.artistName;
