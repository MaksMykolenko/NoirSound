import { mockArtists } from './data';

export async function getArtists() {
  return [...mockArtists];
}

/** In mock mode, all mock artists have tracks. */
export async function getArtistsWithTracks() {
  return [...mockArtists];
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
