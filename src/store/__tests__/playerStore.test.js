import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore } from '../playerStore';

const track = {
  id: 'track-1',
  artistId: 'artist-1',
  title: 'API Track',
  artistName: 'API Artist',
  duration: 180,
  coverUrl: '',
  isStreamable: true,
};

function successResponse(data = { success: true }) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => data,
  };
}

describe('usePlayerStore in real API mode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    usePlayerStore.setState({
      currentTrack: null,
      queue: [],
      originalQueue: [],
      isPlaying: false,
      volume: 0.5,
      progress: 0,
      duration: 0,
      repeatMode: 'none',
      shuffle: false,
      playbackError: null,
      likedTracks: [],
      recentlyPlayed: [],
      recentlyPlayedError: null,
      isPlayerCollapsed: false,
    });
  });

  it('adds Recently Played only after audio playback starts', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successResponse()));

    await usePlayerStore.getState().playTrack(track);

    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().recentlyPlayed).toEqual([track]);
  });

  it('shows a stream error and does not fabricate playback', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new Error('Stream rejected'));

    await usePlayerStore.getState().playTrack(track);

    const state = usePlayerStore.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.recentlyPlayed).toEqual([]);
    expect(state.playbackError).toBe('Stream rejected');
  });

  it('applies a like only after the API succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successResponse()));
    await usePlayerStore.getState().toggleLikeTrack(track.id);
    expect(usePlayerStore.getState().likedTracks).toContain(track.id);
  });

  it('adds and removes queue items', () => {
    usePlayerStore.getState().addToQueue(track);
    expect(usePlayerStore.getState().queue).toEqual([track]);
    usePlayerStore.getState().removeFromQueue(track.id);
    expect(usePlayerStore.getState().queue).toEqual([]);
  });

  it('keeps unavailable releases out of the playback queue', () => {
    const unavailableTrack = {
      ...track,
      id: 'track-unavailable',
      isStreamable: false,
    };

    usePlayerStore.getState().setQueue([unavailableTrack, track]);

    expect(usePlayerStore.getState().queue).toEqual([track]);
    expect(usePlayerStore.getState().originalQueue).toEqual([track]);
  });
});
