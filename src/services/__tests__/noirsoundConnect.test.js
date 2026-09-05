import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { connectPresenceService } from '../noirsoundConnect';
import * as desktopConnectApi from '../../api/desktopConnect';
import { useUserStore } from '../../store/userStore';

describe('NoirSound Connect Presence Service', () => {
  const mockTrack = {
    id: 'track-test-101',
    title: 'Midnight Reverie',
    duration: 180
  };

  let sendSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    sendSpy = vi.spyOn(desktopConnectApi, 'sendPresenceEvent').mockResolvedValue({ acknowledged: true });
    useUserStore.setState({
      user: { id: 'user-123', username: 'tester', displayName: 'Tester' }
    });
    connectPresenceService.stopHeartbeat();
    connectPresenceService.currentTrackId = null;
    connectPresenceService.isPlaying = false;
  });

  afterEach(() => {
    connectPresenceService.stopHeartbeat();
    vi.useRealTimers();
  });

  it('emits play event and starts heartbeat when notifyPlay is called', async () => {
    connectPresenceService.notifyPlay(mockTrack, 0);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        event: 'play',
        trackId: mockTrack.id,
        positionMs: 0
      }),
      expect.anything()
    );

    // Fast-forward 20s for heartbeat
    vi.advanceTimersByTime(20000);
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(sendSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        version: 1,
        event: 'heartbeat',
        trackId: mockTrack.id
      }),
      expect.anything()
    );
  });

  it('emits pause event and stops heartbeat on notifyPause', () => {
    connectPresenceService.notifyPlay(mockTrack, 10);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    connectPresenceService.notifyPause(mockTrack, 15);
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(sendSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        version: 1,
        event: 'pause',
        trackId: mockTrack.id,
        positionMs: 15000
      }),
      expect.anything()
    );

    // Advancing timers should not send heartbeat anymore
    vi.advanceTimersByTime(40000);
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });

  it('debounces seek events', () => {
    connectPresenceService.notifyPlay(mockTrack, 0);
    sendSpy.mockClear();

    // Rapid seeking
    connectPresenceService.notifySeek(mockTrack, 40);
    connectPresenceService.notifySeek(mockTrack, 42);
    connectPresenceService.notifySeek(mockTrack, 45);

    expect(sendSpy).toHaveBeenCalledTimes(0);

    // Advance 300ms debounce
    vi.advanceTimersByTime(300);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        event: 'seek',
        trackId: mockTrack.id,
        positionMs: 45000
      }),
      expect.anything()
    );
  });

  it('emits ended and cleans up track state', () => {
    connectPresenceService.notifyPlay(mockTrack, 175);
    sendSpy.mockClear();

    connectPresenceService.notifyEnded();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        event: 'ended',
        trackId: mockTrack.id
      }),
      expect.anything()
    );
    expect(connectPresenceService.currentTrackId).toBeNull();
  });

  it('does not send presence if user is not logged in', () => {
    useUserStore.setState({ user: null });
    connectPresenceService.notifyPlay(mockTrack, 0);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('gracefully handles api errors without throwing', async () => {
    sendSpy.mockRejectedValue(new Error('Network error'));
    expect(() => connectPresenceService.notifyPlay(mockTrack, 0)).not.toThrow();
  });
});
