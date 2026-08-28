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

  it('uses Beat wording, contact navigation, and hides an unavailable lyrics action', () => {
    const navigate = vi.fn();
    const openReport = vi.fn();
    const actions = buildTrackContextActions({
      track: {
        id: 'beat-1',
        title: 'Cold Circuit',
        artistId: 'producer-1',
        contentType: 'BEAT',
        isStreamable: true,
        hasLyrics: false,
        beatContactEnabled: true,
      },
      player: {
        currentTrack: null,
        likedTracks: [],
        queue: [],
        playNext: vi.fn(),
        playTrack: vi.fn(),
        toggleLikeTrack: vi.fn(),
      },
      navigate,
      openAddToPlaylist: vi.fn(),
      openReport,
    });

    expect(actions.find((action) => action.id === 'track-play').label).toBe('Play beat');
    expect(actions.find((action) => action.id === 'track-playlist').label).toBe('Add beat to playlist');
    expect(actions.find((action) => action.id === 'track-open').label).toBe('Go to beat');
    expect(actions.find((action) => action.id === 'track-artist').label).toBe('Go to producer');
    expect(actions.find((action) => action.id === 'track-lyrics')).toBeUndefined();

    actions.find((action) => action.id === 'track-contact-producer').onSelect();
    expect(navigate).toHaveBeenCalledWith('/artist/producer-1#contact');
    actions.find((action) => action.id === 'track-report').onSelect();
    expect(openReport).toHaveBeenCalledWith({ targetType: 'TRACK', targetId: 'beat-1' });
  });
});
