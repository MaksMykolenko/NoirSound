export async function getListeningStats() {
  return {
    totalListeningSeconds: 0,
    totalListeningMinutes: 0,
    tracksPlayed: 0,
    uniqueArtists: 0,
    topGenre: null,
    topTrackId: null,
    topGenres: [],
    topArtists: [],
    topTracks: [],
  };
}

export async function recordPlayEvent() {
  return { success: true };
}

export async function getRecentlyPlayed() {
  return [];
}
