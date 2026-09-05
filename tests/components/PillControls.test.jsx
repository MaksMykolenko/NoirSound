import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ArtistCard from '../../src/components/artists/ArtistCard';
import GenrePill from '../../src/components/ui/GenrePill';
import { StatusBadge } from '../../src/components/admin/AdminUI';
import { useUserStore } from '../../src/store/userStore';
import { followArtist, unfollowArtist } from '../../src/api/artists';

vi.mock('../../src/api/artists', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, followArtist: vi.fn(), unfollowArtist: vi.fn() };
});

const artist = { id: 'artist-1', name: 'Static Bloom', avatarUrl: null, monthlyListeners: 1200, isFollowing: false };

function renderCard(props = {}) {
  return render(<ArtistCard artist={{ ...artist, ...props }} />, { wrapper: MemoryRouter });
}

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function ControlledGenrePill({ onToggle }) {
  const [active, setActive] = React.useState(false);
  return (
    <GenrePill
      label="Techno"
      active={active}
      onClick={() => {
        onToggle();
        setActive((value) => !value);
      }}
    />
  );
}

describe('Pill controls — Follow / Following (ArtistCard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    followArtist.mockReset();
    unfollowArtist.mockReset();
    useUserStore.setState({ user: { id: 'listener-1', role: 'LISTENER' }, setAuthModalOpen: vi.fn() });
  });

  it('Follow reports aria-pressed=false', () => {
    renderCard();
    const button = screen.getByRole('button', { name: 'Follow' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('Following reports aria-pressed=true and remains enabled', () => {
    renderCard({ isFollowing: true });
    const button = screen.getByRole('button', { name: 'Following' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    // The core requirement: Following must remain an active, operable control.
    expect(button).not.toBeDisabled();
    expect(button).toHaveAccessibleName('Following');
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('supports %s for Follow and Unfollow without duplicate activation', async (_label, key) => {
    followArtist.mockResolvedValue({ success: true, following: true, followerCount: 1 });
    unfollowArtist.mockResolvedValue({ success: true, following: false, followerCount: 0 });
    const user = userEvent.setup();
    renderCard();

    const followButton = screen.getByRole('button', { name: 'Follow' });
    followButton.focus();
    expect(followButton).toHaveFocus();
    await user.keyboard(key);

    const followingButton = await screen.findByRole('button', { name: 'Following' });
    expect(followArtist).toHaveBeenCalledTimes(1);
    expect(followingButton).toHaveAttribute('aria-pressed', 'true');

    followingButton.focus();
    expect(followingButton).toHaveFocus();
    await user.keyboard(key);

    const restoredFollowButton = await screen.findByRole('button', { name: 'Follow' });
    expect(unfollowArtist).toHaveBeenCalledTimes(1);
    expect(restoredFollowButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('exposes native loading semantics, blocks duplicate activation, and recovers after success', async () => {
    const request = deferred();
    followArtist.mockReturnValue(request.promise);
    const user = userEvent.setup();
    renderCard();

    const button = screen.getByRole('button', { name: 'Follow' });
    button.focus();
    await user.keyboard('{Enter}');

    const savingButton = await screen.findByRole('button', { name: 'Saving…' });
    expect(savingButton).toBeDisabled();
    expect(savingButton).toHaveAttribute('aria-busy', 'true');
    expect(savingButton).toHaveAttribute('aria-pressed', 'false');
    expect(savingButton).toHaveAccessibleName('Saving…');

    await user.keyboard('{Enter} ');
    await user.click(savingButton);
    expect(followArtist).toHaveBeenCalledTimes(1);

    request.resolve({ success: true, following: true, followerCount: 1 });
    const followingButton = await screen.findByRole('button', { name: 'Following' });
    expect(followingButton).toBeEnabled();
    expect(followingButton).not.toHaveAttribute('aria-busy');
    expect(followingButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('removes loading semantics and preserves committed state after failure', async () => {
    const request = deferred();
    followArtist.mockReturnValue(request.promise);
    const user = userEvent.setup();
    renderCard();

    const button = screen.getByRole('button', { name: 'Follow' });
    button.focus();
    await user.keyboard(' ');

    const savingButton = await screen.findByRole('button', { name: 'Saving…' });
    expect(savingButton).toBeDisabled();
    expect(savingButton).toHaveAttribute('aria-busy', 'true');

    request.reject(new Error('network error'));
    const restoredButton = await screen.findByRole('button', { name: 'Follow' });
    await waitFor(() => expect(restoredButton).toBeEnabled());
    expect(restoredButton).not.toHaveAttribute('aria-busy');
    expect(restoredButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('blocks duplicate Unfollow activation and restores committed Following after failure', async () => {
    const request = deferred();
    unfollowArtist.mockReturnValue(request.promise);
    const user = userEvent.setup();
    renderCard({ isFollowing: true });

    const button = screen.getByRole('button', { name: 'Following' });
    button.focus();
    await user.keyboard('{Enter}');

    const savingButton = await screen.findByRole('button', { name: 'Saving…' });
    expect(savingButton).toBeDisabled();
    expect(savingButton).toHaveAttribute('aria-busy', 'true');
    expect(savingButton).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{Enter} ');
    await user.click(savingButton);
    expect(unfollowArtist).toHaveBeenCalledTimes(1);
    expect(followArtist).not.toHaveBeenCalled();

    request.reject(new Error('network error'));
    const restoredButton = await screen.findByRole('button', { name: 'Following' });
    await waitFor(() => expect(restoredButton).toBeEnabled());
    expect(restoredButton).not.toHaveAttribute('aria-busy');
    expect(restoredButton).toHaveAttribute('aria-pressed', 'true');
  });

});

describe('Pill controls — genre filter chip (GenrePill)', () => {
  it('reports selection state without changing the accessible genre name', () => {
    const { rerender } = render(<GenrePill label="Techno" active={false} onClick={() => {}} />);
    const chip = screen.getByRole('button', { name: 'Techno' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    rerender(<GenrePill label="Techno" active onClick={() => {}} />);
    const selectedChip = screen.getByRole('button', { name: 'Techno' });
    expect(selectedChip).toHaveAttribute('aria-pressed', 'true');
    expect(selectedChip).toHaveAccessibleName('Techno');
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('supports %s activation with controlled aria-pressed state', async (_label, key) => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    const initialScrollY = window.scrollY;
    render(<ControlledGenrePill onToggle={onToggle} />);

    const chip = screen.getByRole('button', { name: 'Techno' });
    chip.focus();
    expect(chip).toHaveFocus();
    await user.keyboard(key);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip).toHaveFocus();
    expect(window.scrollY).toBe(initialScrollY);
  });
});

describe('Pill controls — role & status badges (StatusBadge)', () => {
  it('renders status markers as non-focusable information', () => {
    const { container } = render(<StatusBadge status="PUBLISHED" />);
    const badge = container.querySelector('span');
    // Badges are markers: not buttons, not focusable.
    expect(badge?.tagName).toBe('SPAN');
    expect(badge).not.toHaveAttribute('tabindex');

  });

});
