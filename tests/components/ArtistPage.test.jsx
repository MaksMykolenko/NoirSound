import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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

function releaseCard(trackId) {
  const card = document.querySelector(`article[data-track-id="${trackId}"]`);
  expect(card).not.toBeNull();
  return card;
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

  it('keeps the API calendar year for date-only values in negative UTC offsets', async () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';

    try {
      getArtistById.mockResolvedValue(baseArtist);
      getTracksByArtist.mockResolvedValue([{ ...tracks[0], releaseDate: '2026-01-01' }]);
      renderArtist();

      await screen.findByRole('heading', { level: 1, name: 'Static Bloom' });
      expect(releaseCard('t1').querySelector('p')).toHaveTextContent(/^2026$/);
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
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

    const metrics = screen.getByLabelText('Artist audience metrics');
    expect(metrics.tagName).toBe('DL');
    const metricGroups = Array.from(metrics.children);
    expect(metricGroups).toHaveLength(2);
    metricGroups.forEach((group) => {
      expect(group.tagName).toBe('DIV');
      expect(Array.from(group.children, (child) => child.tagName)).toEqual(['DT', 'DD']);
    });
    expect(metricGroups.map((group) => group.querySelector('dt').textContent)).toEqual([
      i18n.t('profile.followers'),
      i18n.t('profile.monthlyListeners'),
    ]);

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

  it('renders year-only release metadata without inventing English type labels', async () => {
    getArtistById.mockResolvedValue(baseArtist);
    getTracksByArtist.mockResolvedValue([
      tracks[0],
      { ...tracks[1], releaseType: 'MIXTAPE' },
    ]);
    renderArtist();

    await screen.findByRole('heading', { level: 1, name: 'Static Bloom' });

    const missingTypeCard = releaseCard('t1');
    const unknownTypeCard = releaseCard('t2');
    expect(missingTypeCard.querySelector('p')).toHaveTextContent(/^2026$/);
    expect(unknownTypeCard.querySelector('p')).toHaveTextContent(/^2026$/);
    expect(missingTypeCard).not.toHaveTextContent('Single');
    expect(unknownTypeCard).not.toHaveTextContent('Single');
    expect(unknownTypeCard).not.toHaveTextContent('MIXTAPE');
  });

  it('does not invent a Ukrainian Single label when release type is absent', async () => {
    await i18n.changeLanguage('uk');
    getArtistById.mockResolvedValue(baseArtist);
    getTracksByArtist.mockResolvedValue([tracks[0]]);
    renderArtist();

    await screen.findByRole('heading', { level: 1, name: 'Static Bloom' });

    const card = releaseCard('t1');
    expect(card.querySelector('p')).toHaveTextContent(/^2026$/);
    expect(card).not.toHaveTextContent('Сингл');
    expect(card).not.toHaveTextContent('Single');
  });

  it('uses a valid createdAt year and omits metadata when both dates are invalid or missing', async () => {
    getArtistById.mockResolvedValue(baseArtist);
    getTracksByArtist.mockResolvedValue([
      {
        ...tracks[0],
        id: 'created-at-track',
        title: 'Created At Signal',
        releaseDate: 'not-a-date',
        createdAt: '2025-04-18T10:00:00.000Z',
      },
      {
        ...tracks[0],
        id: 'invalid-date-track',
        title: 'Invalid Date Signal',
        releaseDate: 'not-a-date',
        createdAt: 'also-not-a-date',
      },
      {
        ...tracks[0],
        id: 'missing-date-track',
        title: 'Missing Date Signal',
        releaseDate: null,
        createdAt: null,
      },
    ]);
    renderArtist();

    await screen.findByRole('heading', { level: 1, name: 'Static Bloom' });

    expect(releaseCard('created-at-track').querySelector('p')).toHaveTextContent(/^2025$/);
    expect(releaseCard('invalid-date-track').querySelector('p')).toBeNull();
    expect(releaseCard('missing-date-track').querySelector('p')).toBeNull();
  });

  it('uses the stable generated fallback without truncating a long artist name', async () => {
    const longName = 'Нічні сигнали порожнього міста — Static Bloom 🌙';
    getArtistById.mockResolvedValue({ ...baseArtist, name: longName, avatarUrl: null });
    renderArtist();

    expect(await screen.findByRole('heading', { level: 1, name: longName })).toHaveTextContent(longName);
    expect(screen.getAllByRole('img', { name: `Generated avatar for ${longName}` })).toHaveLength(1);
  });

  it('does not repeat the hero avatar in the About section', async () => {
    getArtistById.mockResolvedValue({ ...baseArtist, avatarUrl: '/static-bloom.jpg' });
    renderArtist();

    await screen.findByRole('heading', { level: 1, name: 'Static Bloom' });
    expect(screen.getAllByRole('img', { name: 'Static Bloom' })).toHaveLength(1);
    expect(within(screen.getByTestId('artist-about')).queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps discography cards bounded and a single About panel readable', () => {
    const css = readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toContain('grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 14rem));');
    expect(css).toMatch(/\.ns-artist-discography-grid\s*\{[^}]*justify-content: start;/);
    expect(css).toMatch(/\.ns-artist-detail-grid--single\s*\{[^}]*max-width: 48rem;/);
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
