import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '../../src/i18n';
import { getArtistById, getTracksByArtist, followArtist } from '../../src/api';
import { useUserStore } from '../../src/store/userStore';
import { usePlayerStore } from '../../src/store/playerStore';

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

const tracks = [
  {
    id: 't1',
    title: 'Night Signal',
    artistId: 'a1',
    artistName: 'Static Bloom',
    audioUrl: '/audio/night-signal.mp3',
    coverUrl: null,
    duration: 182,
    plays: 420,
    releaseDate: '2026-03-12',
    isStreamable: true,
  },
  {
    id: 't2',
    title: 'Empty City',
    artistId: 'a1',
    artistName: 'Static Bloom',
    audioUrl: '/audio/empty-city.mp3',
    coverUrl: null,
    duration: 205,
    plays: 940,
    releaseDate: '2026-01-08',
    isStreamable: true,
  },
];

const initialPlayerState = usePlayerStore.getState();

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
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    getTracksByArtist.mockResolvedValue([]);
    useUserStore.setState({
      user: { id: 'listener-1', role: 'LISTENER' },
      setAuthModalOpen: vi.fn(),
    });
    usePlayerStore.setState(initialPlayerState, true);
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

  it('renders focus genres in English regardless of UI language', async () => {
    getArtistById.mockResolvedValue({ ...baseArtist, genres: ['hip_hop', 'electronic'] });
    await i18n.changeLanguage('uk');
    renderArtist();

    await screen.findByText('Static Bloom');
    expect(screen.getByText('Hip-Hop')).toBeInTheDocument();
    expect(screen.getByText('Electronic')).toBeInTheDocument();
    expect(screen.queryByText('Хіп-хоп')).not.toBeInTheDocument();
    expect(screen.queryByText('Електроніка')).not.toBeInTheDocument();

    await i18n.changeLanguage('en');
  });

  it('renders one complete h1 and keeps the required section order', async () => {
    getArtistById.mockResolvedValue(baseArtist);
    getTracksByArtist.mockResolvedValue(tracks);
    renderArtist();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Static Bloom' });
    expect(heading).toHaveTextContent('Static Bloom');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    const popular = screen.getByTestId('artist-popular');
    const discography = screen.getByTestId('artist-discography');
    const about = screen.getByTestId('artist-about');
    expect(popular.nextElementSibling).toBe(discography);
    expect(discography.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('starts the real artist queue in popularity order', async () => {
    const playTrack = vi.fn();
    usePlayerStore.setState({
      currentTrack: null,
      queueSource: null,
      isPlaying: false,
      playTrack,
    });
    getArtistById.mockResolvedValue(baseArtist);
    getTracksByArtist.mockResolvedValue(tracks);
    const user = userEvent.setup();
    renderArtist();

    await screen.findByRole('heading', { level: 1, name: 'Static Bloom' });
    await user.click(screen.getByRole('button', { name: 'Play' }));

    expect(playTrack).toHaveBeenCalledWith(
      tracks[1],
      [tracks[1], tracks[0]],
      { type: 'artist', id: 'a1', name: 'Static Bloom' }
    );
  });

  it('renders release cards as real track links and mobile-safe Popular actions', async () => {
    getArtistById.mockResolvedValue(baseArtist);
    getTracksByArtist.mockResolvedValue(tracks);
    renderArtist();

    const popular = await screen.findByTestId('artist-popular');
    expect(within(popular).getByRole('button', { name: 'Play Empty City' })).toBeInTheDocument();
    expect(within(popular).getByRole('button', { name: 'More actions for Empty City' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open release Night Signal' })).toHaveAttribute('href', '/track/t1');
  });

  it('uses the stable generated fallback without truncating a long artist name', async () => {
    const longName = 'Нічні сигнали порожнього міста — Static Bloom 🌙';
    getArtistById.mockResolvedValue({ ...baseArtist, name: longName, avatarUrl: null });
    renderArtist();

    expect(await screen.findByRole('heading', { level: 1, name: longName })).toHaveTextContent(longName);
    expect(screen.getByRole('img', { name: `Generated avatar for ${longName}` })).toBeInTheDocument();
  });

  it('omits unsupported optional sections and empty social panels', async () => {
    getArtistById.mockResolvedValue({ ...baseArtist, socialLinks: {} });
    renderArtist();

    await screen.findByRole('heading', { level: 1, name: 'Static Bloom' });
    expect(screen.queryByTestId('artist-socials')).not.toBeInTheDocument();
    expect(screen.queryByText(/related artists/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/featured playlists/i)).not.toBeInTheDocument();
  });

  it('retries a failed artist request without leaving the error state mounted', async () => {
    getArtistById
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce(baseArtist);
    const user = userEvent.setup();
    renderArtist();

    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(getArtistById).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { level: 1, name: 'Static Bloom' })).toBeInTheDocument();
  });
});
