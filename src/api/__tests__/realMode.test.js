import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTracks } from '../tracks';

describe('real API mode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws an ApiError instead of returning demo tracks on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));
    await expect(getTracks()).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: 'Network offline',
    });
  });
});
