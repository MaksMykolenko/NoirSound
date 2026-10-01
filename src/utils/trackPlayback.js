export const canPlayTrack = track => track?.isAvailable !== false && (
  track?.playbackMode === 'OFFICIAL_EMBED' || (track?.isStreamable ?? Boolean(track?.audioUrl))
);
export const canQueueTrack = track => !['OFFICIAL_EMBED', 'LINK_OUT'].includes(track?.playbackMode) && canPlayTrack(track);
