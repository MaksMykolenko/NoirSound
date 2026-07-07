import { describe, expect, it } from 'vitest';
import {
  addTrackToPlaylist,
  createPlaylist,
  getPlaylistById,
  getPlaylists,
} from '../playlists';

// Demo/mock mode has no backend behind it, but the playlist detail page must
// still render correctly against it (Phase 10 of the playlist detail table
// pass). These checks pin the mock API to the same playlist-track shape the
// real API returns, so PlaylistTrackTable/PlaylistPage work identically in
// both modes.
describe('mock playlists API — playlist detail shape parity', () => {
  it('enriches every track with playlistTrackId, position, addedAt, addedBy, and isAvailable', async () => {
    const playlists = await getPlaylists();
    const playlist = playlists.find((item) => item.id === 'p1');
    expect(playlist.tracks.length).toBeGreaterThan(0);

    playlist.tracks.forEach((track, index) => {
      expect(track.playlistTrackId).toBe(`p1:${track.id}`);
      expect(track.position).toBe(index);
      expect(track.addedBy).toBe(playlist.creator);
      expect(track.isAvailable).toBe(true);
      expect(Number.isNaN(new Date(track.addedAt).getTime())).toBe(false);
    });
  });

  it('never fabricates album/release data -- falls through to the Single tier honestly', async () => {
    const playlist = await getPlaylistById('p1');
    playlist.tracks.forEach((track) => {
      expect(track.albumTitle).toBeNull();
      expect(track.albumId).toBeNull();
      expect(track.releaseTitle).toBeNull();
      expect(track.releasePlaylistId).toBeNull();
    });
  });

  it('produces increasing addedAt timestamps that match playlist order (for date-added sort)', async () => {
    const playlist = await getPlaylistById('p4'); // has 4 tracks
    const times = playlist.tracks.map((track) => new Date(track.addedAt).getTime());
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it('keeps the demo isLiked field consistent with the player store’s mock-mode seed', async () => {
    const playlist = await getPlaylistById('p1');
    const likedIds = new Set(['1', '2', '5']);
    playlist.tracks.forEach((track) => {
      expect(track.isLiked).toBe(likedIds.has(track.id));
    });
  });

  it('returns a fully enriched entry from addTrackToPlaylist, matching the real API contract', async () => {
    const created = await createPlaylist({ name: 'Demo Owner Playlist' });
    const { entry } = await addTrackToPlaylist(created.id, '2');

    expect(entry.track.playlistTrackId).toBe(`${created.id}:2`);
    expect(entry.track.isAvailable).toBe(true);
    expect(entry.track.addedBy).toBe(created.creator);
    expect(entry.position).toBe(0);

    const reloaded = await getPlaylistById(created.id);
    expect(reloaded.tracks).toHaveLength(1);
    expect(reloaded.tracks[0].id).toBe('2');
  });
});
