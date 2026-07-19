import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserProfileHeader, { UserProfileHeaderSkeleton } from '../../src/components/profile/UserProfileHeader';
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

  it('keeps 30% of the avatar inside the banner and reserves its 70% lower protrusion', () => {
    render(
      <UserProfileHeader
        user={profile}
        viewerUserId={profile.id}
        shareUrl="https://noirsound.co/profile/night_listener"
        onEditClick={vi.fn()}
      />
    );

    expect(screen.getByTestId('profile-banner-image')).toHaveAttribute('alt', '');
    expect(screen.getByTestId('profile-banner')).toHaveAttribute('data-profile-banner');
    expect(screen.getByTestId('user-profile-header')).toHaveAttribute('data-owner', 'true');
    expect(screen.getByTestId('profile-avatar-overlap')).toHaveClass('ns-profile-hero__avatar');
    expect(screen.getByTestId('profile-avatar-overlap')).toHaveAttribute('data-profile-avatar');
    expect(screen.getByText(/First line/)).toHaveClass('whitespace-pre-line');
    expect(screen.getByRole('button', { name: i18n.t('profile.editProfile') })).toBeInTheDocument();

    const css = readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toMatch(/\.ns-profile-hero__avatar\s*\{[^}]*top:\s*100%;[^}]*transform:\s*translateY\(-30%\);/);
    expect(css).not.toMatch(/\.ns-profile-hero__avatar\s*\{[^}]*bottom:\s*0/);
    expect(css).not.toMatch(/\.ns-profile-hero__avatar\s*\{[^}]*transform:\s*translateY\((?:30%|50%|-50%)\);/);
    expect(css).toMatch(/0 0 0 4px var\(--ns-bg\)/);
    expect(css).toMatch(/--ns-profile-avatar-size:\s*6\.5rem;\s*--ns-profile-avatar-protrusion:\s*calc\(var\(--ns-profile-avatar-size\) \* 0\.7\)/);
    expect(css).toMatch(/@media \(min-width: 640px\)[\s\S]*?--ns-profile-avatar-size:\s*7rem/);
    expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*?--ns-profile-avatar-size:\s*8rem/);
    expect(css).toMatch(/@media \(min-width: 1280px\)[\s\S]*?--ns-profile-avatar-size:\s*8rem/);
    expect(css).toMatch(/@media \(min-width: 1800px\)[\s\S]*?--ns-profile-avatar-size:\s*8\.5rem/);
    expect(css).toMatch(/@media \(min-width: 2200px\)[\s\S]*?--ns-profile-avatar-size:\s*9rem/);
    expect(css).toMatch(/\.ns-profile-hero__content\s*\{[^}]*var\(--ns-profile-avatar-protrusion\)/);
    expect(css).toMatch(/@media \(min-width: 1280px\)[\s\S]*?height:\s*clamp\(13\.75rem, 18vw, 16\.875rem\)/);
    expect(css).toMatch(/@media \(min-width: 1280px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/);
    expect(css).toMatch(/@media \(min-width: 1280px\)[\s\S]*?align-items:\s*start/);
    expect(css).toMatch(
      /@media \(min-width: 1280px\)[\s\S]*?padding:\s*calc\(var\(--ns-profile-avatar-protrusion\) \+ var\(--ns-space-4\)\)\s*var\(--ns-profile-inline-padding\)\s*var\(--ns-space-5\)/
    );
    expect(css).not.toMatch(/\.ns-profile-hero__content\s*\{[^}]*justify-content:\s*space-between/);
    expect(css).toMatch(/\.ns-profile-hero__actions\s*\{[^}]*position:\s*static/);
    expect(css).toMatch(/\.ns-profile-hero__bio\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).not.toMatch(/\.ns-profile-hero(?:__content)?\s*\{[^}]*min-height:/);

    const headingGroup = screen.getByRole('heading', { name: profile.displayName }).parentElement;
    const metadata = screen.getByText(/Demo environment|Kyiv/).closest('div.flex');
    expect(headingGroup).toHaveClass('xl:flex', 'xl:flex-wrap', 'xl:space-y-0');
    expect(metadata).toHaveClass('pt-1', 'xl:pt-0');
  });

  it('keeps real, generated, broken, and loading avatars in the same geometry slot', () => {
    const { rerender } = render(<UserProfileHeader user={{ ...profile, avatarUrl: '/avatar.jpg' }} />);
    const realSlotClass = screen.getByTestId('profile-avatar-overlap').className;
    expect(screen.getByRole('img', { name: profile.displayName })).toBeInTheDocument();

    rerender(<UserProfileHeader user={{ ...profile, avatarUrl: null }} />);
    expect(screen.getByTestId('profile-avatar-overlap')).toHaveClass('ns-profile-hero__avatar');
    expect(screen.getByTestId('profile-avatar-overlap').className).toBe(realSlotClass);
    expect(screen.getByRole('img', { name: `Generated avatar for ${profile.displayName}` })).toBeInTheDocument();

    rerender(<UserProfileHeaderSkeleton label="Loading profile" />);
    expect(screen.getByTestId('profile-avatar-skeleton')).toHaveClass(
      'ns-profile-hero__avatar',
      'ns-profile-hero__skeleton-surface'
    );
    expect(screen.getByTestId('profile-banner-skeleton')).toHaveClass('ns-profile-hero__banner');
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
    expect(screen.getByTestId('profile-banner')).toHaveAttribute('data-profile-banner');
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
