import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ArtistCard from '../../src/components/artists/ArtistCard';
import { useUserStore } from '../../src/store/userStore';
import { followArtist, unfollowArtist } from '../../src/api/artists';

vi.mock('../../src/api/artists', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    followArtist: vi.fn(),
    unfollowArtist: vi.fn(),
  };
});

const artist = {
  id: 'artist-1',
  name: 'Static Bloom',
  avatarUrl: null,
  monthlyListeners: 1200,
  isFollowing: false,
};

function renderCard(props = {}) {
  return render(<ArtistCard artist={{ ...artist, ...props }} />, { wrapper: MemoryRouter });
}

describe('ArtistCard follow / unfollow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'listener-1', role: 'LISTENER' },
      setAuthModalOpen: vi.fn(),
    });
  });

  it('renders the follow state from the artist payload (e.g. Followed Artists tab)', () => {
    renderCard({ isFollowing: true });
    expect(screen.getByRole('heading', { level: 3, name: artist.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
  });

  it('opens the auth modal instead of calling the API when signed out', async () => {
    const setAuthModalOpen = vi.fn();
    useUserStore.setState({ user: null, setAuthModalOpen });
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Follow' }));

    expect(setAuthModalOpen).toHaveBeenCalledWith(true);
    expect(followArtist).not.toHaveBeenCalled();
  });

  it('follows on click and flips the button to Following only after the API succeeds', async () => {
    followArtist.mockResolvedValue({ success: true, following: true, followerCount: 1 });
    const user = userEvent.setup();
    renderCard();

    const button = screen.getByRole('button', { name: 'Follow' });
    await user.click(button);

    await waitFor(() => expect(followArtist).toHaveBeenCalledWith('artist-1'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument());
  });

  it('unfollows on click when already following, and calls unfollowArtist (not followArtist)', async () => {
    unfollowArtist.mockResolvedValue({ success: true, following: false, followerCount: 0 });
    const user = userEvent.setup();
    renderCard({ isFollowing: true });

    const button = screen.getByRole('button', { name: 'Following' });
    await user.click(button);

    await waitFor(() => expect(unfollowArtist).toHaveBeenCalledWith('artist-1'));
    expect(followArtist).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument());
  });

  it('does not flip state when the API call fails', async () => {
    followArtist.mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Follow' }));

    await waitFor(() => expect(followArtist).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
  });
});
