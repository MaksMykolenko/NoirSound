import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore, __getAudioElementForTests, qualifyThresholdSeconds } from '../playerStore';

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

function playEventCalls(fetchMock) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/play-event'));
}

// Lets any pending qualifying-play report (a chain of several awaited
// promises: report -> incrementPlayStats -> recordPlayEvent -> apiFetch ->
// fetch -> response.json()) fully settle before assertions run.
const flushAsyncWork = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  it('does not report a play or touch Recently Played merely from starting playback', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const fetchMock = vi.fn().mockResolvedValue(successResponse());
    vi.stubGlobal('fetch', fetchMock);

    await usePlayerStore.getState().playTrack(track);

    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().recentlyPlayed).toEqual([]);
    expect(playEventCalls(fetchMock)).toHaveLength(0);
  });

  it('reports exactly one qualifying play and adds to Recently Played once the threshold is crossed', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const fetchMock = vi.fn().mockResolvedValue(successResponse());
    vi.stubGlobal('fetch', fetchMock);

    await usePlayerStore.getState().playTrack(track);

    const audio = __getAudioElementForTests();
    // Qualifying threshold for a 180s track is min(30, 90) = 30s.
    audio.currentTime = 31;
    audio.dispatchEvent(new Event('timeupdate'));
    await flushAsyncWork();

    const calls = playEventCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toContain(`/tracks/${track.id}/play-event`);
    const body = JSON.parse(calls[0][1].body);
    expect(body.durationListenedSeconds).toBeGreaterThanOrEqual(30);
    expect(usePlayerStore.getState().recentlyPlayed).toEqual([track]);

    // Further ticks in the same session must never send a duplicate report.
    audio.currentTime = 60;
    audio.dispatchEvent(new Event('timeupdate'));
    await flushAsyncWork();
    expect(playEventCalls(fetchMock)).toHaveLength(1);
  });

  it('never reports a play or touches Recently Played when skipped before the threshold', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const fetchMock = vi.fn().mockResolvedValue(successResponse());
    vi.stubGlobal('fetch', fetchMock);

    await usePlayerStore.getState().playTrack(track);

    const audio = __getAudioElementForTests();
    audio.currentTime = 5; // well under the 30s threshold
    audio.dispatchEvent(new Event('timeupdate'));
    await flushAsyncWork();

    expect(playEventCalls(fetchMock)).toHaveLength(0);
    expect(usePlayerStore.getState().recentlyPlayed).toEqual([]);
  });

  it('starts a fresh qualifying-play session on every playTrack call', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const fetchMock = vi.fn().mockResolvedValue(successResponse());
    vi.stubGlobal('fetch', fetchMock);

    await usePlayerStore.getState().playTrack(track);
    const audio = __getAudioElementForTests();
    audio.currentTime = 31;
    audio.dispatchEvent(new Event('timeupdate'));
    await flushAsyncWork();
    expect(playEventCalls(fetchMock)).toHaveLength(1);

    // Replaying the same track (e.g. repeat-one, or clicking play again)
    // is a genuinely new listen and must be able to qualify again.
    await usePlayerStore.getState().playTrack(track);
    audio.currentTime = 31;
    audio.dispatchEvent(new Event('timeupdate'));
    await flushAsyncWork();
    expect(playEventCalls(fetchMock)).toHaveLength(2);
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

describe('qualifyThresholdSeconds', () => {
  it('caps the threshold at 30 seconds for long tracks', () => {
    expect(qualifyThresholdSeconds(180)).toBe(30);
  });

  it('uses 50% of duration for short tracks', () => {
    expect(qualifyThresholdSeconds(40)).toBe(20);
  });

  it('falls back to 30 seconds when duration is unknown or zero', () => {
    expect(qualifyThresholdSeconds(0)).toBe(30);
    expect(qualifyThresholdSeconds(undefined)).toBe(30);
  });
});
