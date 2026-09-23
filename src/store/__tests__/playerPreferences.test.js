import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getLikedTracks: vi.fn(), setTrackLiked: vi.fn() }));
vi.mock('../../api/tracks', () => api);
let player;
let users;

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  localStorage.clear();
  api.getLikedTracks.mockResolvedValue([]);
  api.setTrackLiked.mockResolvedValue({ success: true });
  player = (await import('../playerStore')).usePlayerStore;
  users = (await import('../userStore')).useUserStore;
  users.setState({ user: { id: 'listener-a' } });
});
afterEach(() => vi.restoreAllMocks());

describe('persistent listener preferences', () => {
  it.each([0, 0.23, 1])('restores volume %s on a fresh page and applies it to audio', async (volume) => {
    player.getState().setVolume(volume);
    vi.resetModules();
    const fresh = await import('../playerStore');
    expect(fresh.usePlayerStore.getState().volume).toBe(volume);
    expect(fresh.__getAudioElementForTests().volume).toBe(volume);
  });

  it.each(['NaN', 'Infinity', '-1', '2', '', 'broken'])('ignores invalid stored volume %s', async (value) => {
    localStorage.setItem('noirsound.volume', value);
    vi.resetModules();
    const fresh = await import('../playerStore');
    expect(fresh.usePlayerStore.getState().volume).toBe(0.5);
  });

  it('continues operating with blocked storage and rejects nonfinite volume', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => player.getState().setVolume(0.2)).not.toThrow();
    player.getState().setVolume(NaN);
    expect(player.getState().volume).toBe(0.2);
  });

  it('restores both Music and Beat likes and removes a saved like after reload', async () => {
    api.getLikedTracks.mockResolvedValue([{ id: 'music' }, { id: 'beat' }]);
    await player.getState().loadLikedTracks('listener-a');
    expect(player.getState().likedTracks).toEqual(['music', 'beat']);
    await player.getState().toggleLikeTrack('beat');
    expect(api.setTrackLiked).toHaveBeenCalledWith('beat', false);
    expect(player.getState().likedTracks).toEqual(['music']);
  });

  it('waits for hydration before deciding whether a click should unlike', async () => {
    let resolve;
    api.getLikedTracks.mockReturnValue(new Promise((done) => { resolve = done; }));
    const clicked = player.getState().toggleLikeTrack('beat');
    expect(api.setTrackLiked).not.toHaveBeenCalled();
    resolve([{ id: 'beat' }]);
    await clicked;
    expect(api.setTrackLiked).toHaveBeenCalledWith('beat', false);
  });

  it('does not lose concurrent likes on different tracks or duplicate a repeated click', async () => {
    const completions = {};
    api.setTrackLiked.mockImplementation((id) => new Promise((done) => { completions[id] = done; }));
    await player.getState().loadLikedTracks('listener-a');
    const first = player.getState().toggleLikeTrack('music');
    const repeated = player.getState().toggleLikeTrack('music');
    const second = player.getState().toggleLikeTrack('beat');
    await Promise.resolve();
    expect(api.setTrackLiked).toHaveBeenCalledTimes(2);
    completions.beat();
    await second;
    completions.music();
    await Promise.all([first, repeated]);
    expect(new Set(player.getState().likedTracks)).toEqual(new Set(['music', 'beat']));
  });

  it('discards a previous account response on logout or account switch', async () => {
    let resolveOld;
    api.getLikedTracks.mockReturnValueOnce(new Promise((done) => { resolveOld = done; }));
    const old = player.getState().loadLikedTracks('listener-a');
    await player.getState().loadLikedTracks(null);
    users.setState({ user: { id: 'listener-b' } });
    api.getLikedTracks.mockResolvedValue([{ id: 'new-account' }]);
    await player.getState().loadLikedTracks('listener-b');
    resolveOld([{ id: 'old-account' }]);
    await old;
    expect(player.getState().likedTracks).toEqual(['new-account']);
  });

  it('does not show a saved like when the server rejects it', async () => {
    api.setTrackLiked.mockRejectedValue(new Error('offline'));
    await player.getState().toggleLikeTrack('beat');
    expect(player.getState().likedTracks).toEqual([]);
  });
});
