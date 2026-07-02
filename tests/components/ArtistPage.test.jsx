import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getArtistById, getTracksByArtist, followArtist } from '../../src/api';
import { useUserStore } from '../../src/store/userStore';

vi.mock('../../src/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getArtistById: vi.fn(),
    getTracksByArtist: vi.fn(),
    followArtist: vi.fn(),
    unfollowArtist: vi.fn(),
  };
});

import ArtistPage from '../../src/pages/ArtistPage';

const baseArtist = {
  id: 'a1',
  name: 'Static Bloom',
  username: 'staticbloom',
  bio: 'Nocturnal soundscapes.',
  avatarUrl: null,
  bannerUrl: null,
  followers: 128,
  monthlyListeners: 940,
  isFollowing: false,
};

function renderArtist() {
  return render(
    <MemoryRouter initialEntries={['/artist/a1']}>
      <Routes>
        <Route path="/artist/:id" element={<ArtistPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ArtistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTracksByArtist.mockResolvedValue([]);
    useUserStore.setState({
      user: { id: 'listener-1', role: 'LISTENER' },
      setAuthModalOpen: vi.fn(),
    });
  });

  // Regression test: the component used to declare a useState hook
  // (`followActionPending`) after several early `return`s (loading /
  // error / not-found). Since the initial render always takes the
  // loading-guard's early return, that hook was skipped on mount and only
  // called once the artist finished loading -- violating the Rules of
  // Hooks and crashing React with "Rendered more hooks than during the
  // previous render" on every real page view. This test renders the page
  // and lets it transition all the way from loading to loaded, which is
  // exactly the transition that used to throw.
  it('survives the loading-to-loaded transition without a hooks-order crash', async () => {
    getArtistById.mockResolvedValue(baseArtist);
    renderArtist();

    await screen.findByText('Static Bloom');

    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
  });

  it('renders the real follower and monthly listener counts, not placeholders', async () => {
    getArtistById.mockResolvedValue(baseArtist);
    renderArtist();

    await screen.findByText('Static Bloom');

    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('940')).toBeInTheDocument();
  });

  it('hydrates the follow button from the backend-provided isFollowing flag', async () => {
    getArtistById.mockResolvedValue({ ...baseArtist, isFollowing: true });
    renderArtist();

    await screen.findByText('Static Bloom');

    expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
  });

  it('follows on click and reflects the backend follower count afterward', async () => {
    getArtistById.mockResolvedValue(baseArtist);
    followArtist.mockResolvedValue({ success: true, following: true, followerCount: 129 });
    const user = userEvent.setup();
    renderArtist();

    await screen.findByText('Static Bloom');
    await user.click(screen.getByRole('button', { name: 'Follow' }));

    expect(await screen.findByRole('button', { name: 'Following' })).toBeInTheDocument();
    expect(screen.getByText('129')).toBeInTheDocument();
    expect(followArtist).toHaveBeenCalledWith('a1');
  });
});
