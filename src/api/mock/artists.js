import { mockArtists, mockTracks } from './data';
import { normalizeTrackContentType } from '../../utils/trackContent';

export async function getArtists() {
  return [...mockArtists];
}

/** In mock mode, all mock artists have tracks. */
export async function getArtistsWithTracks(options = {}, { signal } = {}) {
  signal?.throwIfAborted();
  const requested = options.contentType && options.contentType !== 'ALL' ? normalizeTrackContentType(options.contentType) : null;
  const tracks = mockTracks.filter((track) => !requested || normalizeTrackContentType(track.contentType) === requested);
  const artistIds = new Set(tracks.map((track) => track.artistId));
  const artists = mockArtists.filter((artist) => artistIds.has(artist.id));
  if (options.sort === 'trending') {
    artists.sort((a, b) => {
      const score = (id) => tracks.filter((track) => track.artistId === id).reduce((sum, track) => sum + Number(track.plays || 0), 0);
      return score(b.id) - score(a.id) || String(a.id).localeCompare(String(b.id));
    });
  }
  return options.limit ? artists.slice(0, Number(options.limit)) : artists;
}

export async function getArtistById(id) {
  const artist = mockArtists.find((item) => item.id === id);
  if (!artist) throw new Error('Artist not found');
  return artist;
}

export async function followArtist() {
  return { success: true, following: true };
}

export async function unfollowArtist() {
  return { success: true, following: false, unfollowed: true };
}

export async function getFollowedArtists() {
  return [...mockArtists].slice(0, 3);
}
