import { describe, expect, it, vi } from 'vitest';
import { buildPlaylistContextActions, buildTrackContextActions } from '../contextMenuActions';

describe('context menu action builders', () => {
  it('lazy-loads lightweight playlist rows before playback', async () => {
    const track = { id: 'track-1', isStreamable: true };
    const resolvePlaylistTracks = vi.fn().mockResolvedValue([
      track,
      { id: 'unavailable', isStreamable: false },
    ]);
    const player = {
      playTrack: vi.fn(),
      addTracksToQueue: vi.fn(),
    };
    const actions = buildPlaylistContextActions({
      playlist: { id: 'playlist-1', name: 'Lightweight', trackCount: 2, tracks: [] },
      player,
      navigate: vi.fn(),
      resolvePlaylistTracks,
    });

    const play = actions.find((action) => action.id === 'playlist-play');
    expect(play.disabled).toBe(false);
    await play.onSelect();

    expect(resolvePlaylistTracks).toHaveBeenCalledOnce();
    expect(player.playTrack).toHaveBeenCalledWith(track, [track], {
      type: 'playlist',
      id: 'playlist-1',
      name: 'Lightweight',
    });
  });

  it('disables playback actions for unavailable tracks while preserving library actions', () => {
    const actions = buildTrackContextActions({
      track: { id: 'track-1', title: 'Unavailable', isStreamable: false },
      player: {
        currentTrack: null,
        likedTracks: [],
        queue: [],
        playNext: vi.fn(),
        toggleLikeTrack: vi.fn(),
      },
      navigate: vi.fn(),
      openAddToPlaylist: vi.fn(),
    });

    expect(actions.find((action) => action.id === 'track-play').disabled).toBe(true);
    expect(actions.find((action) => action.id === 'track-play-next').disabled).toBe(true);
    expect(actions.find((action) => action.id === 'track-playlist').disabled).toBeUndefined();
  });
});
