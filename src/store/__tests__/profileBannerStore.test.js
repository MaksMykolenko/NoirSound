import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  uploadProfileBanner: vi.fn(),
  removeProfileBanner: vi.fn(),
}));

vi.mock('../../api/user', () => ({
  getCurrentUser: vi.fn(),
  initialDemoUser: null,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  updateProfile: vi.fn(),
  ensureMyArtistProfile: vi.fn(),
  uploadProfileBanner: apiMocks.uploadProfileBanner,
  removeProfileBanner: apiMocks.removeProfileBanner,
}));

vi.mock('../../api/stats', () => ({
  getListeningStats: vi.fn(),
  recordPlayEvent: vi.fn(),
}));

import { useUserStore } from '../userStore';

describe('profile banner userStore actions', () => {
  const currentUser = {
    id: 'listener-1',
    username: 'night_listener',
    bannerUrl: 'https://cdn.example/old.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({ user: currentUser });
  });

  it('replaces the authoritative current user after a banner upload', async () => {
    const nextUser = { ...currentUser, bannerUrl: 'https://cdn.example/new.jpg' };
    const file = new File(['banner'], 'banner.jpg', { type: 'image/jpeg' });
    const options = { onProgress: vi.fn() };
    apiMocks.uploadProfileBanner.mockResolvedValue(nextUser);

    await expect(useUserStore.getState().uploadBanner(file, options)).resolves.toBe(nextUser);

    expect(apiMocks.uploadProfileBanner).toHaveBeenCalledWith(file, options);
    expect(useUserStore.getState().user).toBe(nextUser);
  });

  it('replaces the authoritative current user after banner removal', async () => {
    const nextUser = { ...currentUser, bannerUrl: null };
    apiMocks.removeProfileBanner.mockResolvedValue(nextUser);

    await expect(useUserStore.getState().removeBanner()).resolves.toBe(nextUser);

    expect(apiMocks.removeProfileBanner).toHaveBeenCalledOnce();
    expect(useUserStore.getState().user).toBe(nextUser);
  });

  it('preserves the current user when a banner request fails', async () => {
    apiMocks.uploadProfileBanner.mockRejectedValue(new Error('Upload failed'));

    await expect(
      useUserStore.getState().uploadBanner(new File(['x'], 'x.png', { type: 'image/png' }))
    ).rejects.toThrow('Upload failed');

    expect(useUserStore.getState().user).toBe(currentUser);
  });
});
