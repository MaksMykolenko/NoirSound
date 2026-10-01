export const playerTrackHref = track => track.playbackSource === 'external' ? `/external-music/${track.recordingId || ''}` : `/track/${track.id}`;
export const playerArtistLabel = track => track?.playbackSource === 'external' ? `${track.artistName} · ${track.provider}` : track?.artistName;
