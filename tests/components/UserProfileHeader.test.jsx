import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserProfileHeader from '../../src/components/profile/UserProfileHeader';
import i18n from '../../src/i18n';
import { useToastStore } from '../../src/store/toastStore';

const originalToastState = useToastStore.getState();

const profile = {
  id: 'profile-1',
  username: 'night_listener',
  displayName: 'Night Listener',
  avatarUrl: null,
  bannerUrl: '/api/public/profile-banners/profile-1',
  bio: 'First line\nSecond line',
  location: 'Kyiv',
  joinedAt: '2026-01-12T00:00:00.000Z',
  isCreator: false,
};

describe('UserProfileHeader', () => {
  let addToast;
  let writeText;

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    addToast = vi.fn();
    writeText = vi.fn().mockResolvedValue(undefined);
    useToastStore.setState({ addToast });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    cleanup();
    useToastStore.setState(originalToastState, true);
  });

  it('exposes the owner edit action and keeps decorative banner alt text empty', () => {
    render(
      <UserProfileHeader
        user={profile}
        viewerUserId={profile.id}
        shareUrl="https://noirsound.co/profile/night_listener"
        onEditClick={vi.fn()}
      />
    );

    expect(screen.getByTestId('profile-banner-image')).toHaveAttribute('alt', '');
    expect(screen.getByRole('button', { name: i18n.t('profile.editProfile') })).toBeInTheDocument();

  });

  it('switches from the supplied avatar to a generated fallback when the source is removed', () => {
    const { rerender } = render(<UserProfileHeader user={{ ...profile, avatarUrl: '/avatar.jpg' }} />);
    expect(screen.getByRole('img', { name: profile.displayName })).toBeInTheDocument();

    rerender(<UserProfileHeader user={{ ...profile, avatarUrl: null }} />);
    expect(screen.getByRole('img', { name: `Generated avatar for ${profile.displayName}` })).toBeInTheDocument();

  });

  it('hides owner controls for a different stable user id and uses the semantic fallback', () => {
    render(
      <UserProfileHeader
        user={{ ...profile, bannerUrl: 'data:image/png;base64,unsafe' }}
        viewerUserId="different-user-id"
        onEditClick={vi.fn()}
      />
    );

    expect(screen.getByTestId('profile-banner-fallback')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('profile.editProfile') })).not.toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: i18n.t('profile.copyProfileLink', { name: profile.displayName }),
    })).toBeInTheDocument();
  });

  it('falls back without retrying when the controlled banner image fails', () => {
    render(<UserProfileHeader user={{ ...profile, bannerUrl: 'https://cdn.test/banner.webp' }} />);

    fireEvent.error(screen.getByTestId('profile-banner-image'));

    expect(screen.queryByTestId('profile-banner-image')).not.toBeInTheDocument();
    expect(screen.getByTestId('profile-banner-fallback')).toBeInTheDocument();
  });

  it('renders a local blob banner returned by the explicit mock upload flow', () => {
    render(<UserProfileHeader user={{ ...profile, bannerUrl: 'blob:mock-banner' }} />);

    expect(screen.getByTestId('profile-banner-image')).toHaveAttribute('src', 'blob:mock-banner');
  });

  it('copies the canonical public profile URL and reports localized success', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const publicUrl = 'https://noirsound.co/profile/night_listener';
    render(<UserProfileHeader user={profile} shareUrl={publicUrl} />);

    await user.click(screen.getByRole('button', {
      name: i18n.t('profile.copyProfileLink', { name: profile.displayName }),
    }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(publicUrl));
    expect(addToast).toHaveBeenCalledWith(i18n.t('profile.shareCopied'), 'success');
  });
});
