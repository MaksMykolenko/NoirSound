// Share queue semantics with the player; warming never calls play() or records a listen.
export function nextQueuedTrack({ currentTrack, queue, repeatMode }) {
  if (!currentTrack || !queue.length) return null;
  if (repeatMode === 'one') return currentTrack;
  const index = queue.findIndex(track => track.id === currentTrack.id);
  return queue[index + 1] || (repeatMode === 'all' ? queue[0] : null);
}
