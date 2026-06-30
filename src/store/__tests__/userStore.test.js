import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_LISTENING_STATS,
  useUserStore,
} from '../userStore';

function failedResponse(status, error) {
  return {
    ok: false,
    status,
    statusText: error,
    headers: { get: () => 'application/json' },
    json: async () => ({ error }),
  };
}

describe('useUserStore in real API mode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useUserStore.setState({
      user: null,
      authHydrated: false,
      authError: null,
      activity: [],
      userListeningStats: { ...EMPTY_LISTENING_STATS },
      listeningStatsHydrated: false,
      listeningStatsError: null,
    });
  });

  it('starts without a fabricated authenticated user', () => {
    expect(useUserStore.getState().user).toBeNull();
  });

  it('treats a 401 from auth/me as logged out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      failedResponse(401, 'Unauthorized')
    ));

    await expect(useUserStore.getState().fetchCurrentUser()).resolves.toBeNull();
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().authHydrated).toBe(true);
    expect(useUserStore.getState().authError).toBeNull();
  });

  it('does not fabricate listening stats when telemetry fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      failedResponse(503, 'Telemetry unavailable')
    ));

    await expect(
      useUserStore.getState().incrementPlayStats('track-1', 'artist-1')
    ).rejects.toMatchObject({ status: 503 });
    expect(useUserStore.getState().userListeningStats).toEqual(EMPTY_LISTENING_STATS);
  });

  it('does not create local activity in real mode', () => {
    useUserStore.getState().addActivity('comment', 'Commented on a track');
    expect(useUserStore.getState().activity).toEqual([]);
  });
});
