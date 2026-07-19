import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicProfile } from '../../src/api/user';
import PublicProfile from '../../src/pages/PublicProfile';
import i18n from '../../src/i18n';
import { useUserStore } from '../../src/store/userStore';

vi.mock('../../src/api/user', async (importOriginal) => ({
  ...await importOriginal(),
  getPublicProfile: vi.fn(),
}));

const originalUserState = useUserStore.getState();

const publicProfile = {
  id: 'profile-1',
  username: 'night_listener',
  displayName: 'Night Listener',
  avatarUrl: null,
  bannerUrl: '/api/public/profile-banners/profile-1',
  bio: 'Public biography',
  location: 'Kyiv',
  joinedAt: '2026-01-12T00:00:00.000Z',
  artistProfileId: null,
  isCreator: false,
};

function LocationProbe() {
  const location = useLocation();
  return <p>{`${location.pathname}${location.search}`}</p>;
}

function renderPublicProfile(initialPath = '/profile/night_listener') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/profile/:username" element={<PublicProfile />} />
          <Route path="/profile" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PublicProfile', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    getPublicProfile.mockReset();
    useUserStore.setState({ user: null, authHydrated: true });
  });

  afterEach(() => {
    cleanup();
    useUserStore.setState(originalUserState, true);
  });

  it('reserves the final banner and avatar geometry while the public profile loads', () => {
    getPublicProfile.mockReturnValue(new Promise(() => {}));
    renderPublicProfile();

    expect(screen.getByRole('status', { name: i18n.t('profile.loadingPublicProfile') })).toBeInTheDocument();
    expect(screen.getByTestId('profile-banner-skeleton')).toHaveAttribute('data-profile-banner');
    expect(screen.getByTestId('profile-avatar-skeleton')).toHaveAttribute('data-profile-avatar');
  });

  it('loads an anonymous public profile without exposing owner controls', async () => {
    getPublicProfile.mockResolvedValue(publicProfile);
    renderPublicProfile();

    expect(await screen.findByRole('heading', { level: 1, name: publicProfile.displayName })).toBeInTheDocument();
    expect(getPublicProfile).toHaveBeenCalledWith(publicProfile.username);
    expect(screen.getByTestId('profile-banner-image')).toHaveAttribute('src', publicProfile.bannerUrl);
    expect(screen.queryByRole('button', { name: i18n.t('profile.editProfile') })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://noirsound.co/profile/${publicProfile.username}`
      );
    });
  });

  it('refetches the mounted public-profile cache after the owner banner changes', async () => {
    const updatedBannerUrl = '/api/public/profile-banners/profile-1/updated-banner.jpg';
    getPublicProfile
      .mockResolvedValueOnce(publicProfile)
      .mockResolvedValueOnce({ ...publicProfile, bannerUrl: updatedBannerUrl });
    renderPublicProfile();

    expect(await screen.findByTestId('profile-banner-image')).toHaveAttribute(
      'src',
      publicProfile.bannerUrl
    );

    window.dispatchEvent(new CustomEvent('noirsound:user-profile-changed', {
      detail: { id: publicProfile.id, username: publicProfile.username },
    }));

    await waitFor(() => {
      expect(screen.getByTestId('profile-banner-image')).toHaveAttribute('src', updatedBannerUrl);
    });
    expect(getPublicProfile).toHaveBeenCalledTimes(2);
  });

  it('uses stable user ids for ownership even when the viewer username differs', async () => {
    const user = userEvent.setup();
    useUserStore.setState({
      user: { id: publicProfile.id, username: 'renamed_viewer' },
      authHydrated: true,
    });
    getPublicProfile.mockResolvedValue(publicProfile);
    renderPublicProfile();

    const edit = await screen.findByRole('button', { name: i18n.t('profile.editProfile') });
    await user.click(edit);

    expect(screen.getByText('/profile?tab=settings')).toBeInTheDocument();
  });

  it('renders a localized not-found state without owner controls', async () => {
    getPublicProfile.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));
    renderPublicProfile('/profile/missing_user');

    expect(await screen.findByRole('heading', {
      level: 1,
      name: i18n.t('profile.publicProfileNotFound'),
    })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('profile.editProfile') })).not.toBeInTheDocument();
  });
});
