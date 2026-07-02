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

export async function getArtistDashboard() {
  return {
    followers: 0,
    monthlyListeners: 0,
    isHidden: false,
    totalPlays: 0,
    totalLikes: 0,
    publishedTrackCount: 0,
    tracks: [],
    topTracks: [],
    recentUploads: [],
    failedUploads: [],
    geography: null,
    trends: null,
  };
}
