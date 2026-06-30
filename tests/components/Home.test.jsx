import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import Home from '../../src/pages/Home';
import { getArtistsWithTracks, getTracks } from '../../src/api';

vi.mock('../../src/api', () => ({
  getTracks: vi.fn(),
  getArtistsWithTracks: vi.fn(),
}));

vi.mock('../../src/store/playerStore', () => ({
  usePlayerStore: () => ({
    recentlyPlayed: [],
    loadRecentlyPlayed: vi.fn(),
    currentTrack: null,
    isPlaying: false,
    playTrack: vi.fn(),
    togglePlay: vi.fn(),
    likedTracks: [],
    toggleLikeTrack: vi.fn(),
  }),
}));

vi.mock('../../src/store/userStore', () => ({
  useUserStore: () => ({
    user: null,
    authHydrated: true,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/discover" element={<LocationProbe />} />
        <Route path="/upload" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

const realTrack = {
  id: 'track-1',
  title: 'Real API Release',
  artistId: 'artist-1',
  artistName: 'API Artist',
  genre: 'hip_hop',
  duration: 180,
  coverUrl: '',
  isStreamable: false,
};

describe('Home real API states', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    getTracks.mockResolvedValue([]);
    getArtistsWithTracks.mockResolvedValue([]);
  });

  it('renders the localized hero and primary Home actions', () => {
    renderHome();

    expect(screen.getByTestId('home-hero')).toBeInTheDocument();
    expect(screen.getByTestId('home-hero-discover')).toHaveTextContent(i18n.t('actions.discoverMusic'));
    expect(screen.getByTestId('home-hero-upload')).toHaveTextContent(i18n.t('actions.uploadTrack'));
  });

  it('shows one polished catalogue empty state without fake tracks or a duplicate artist empty state', async () => {
    renderHome();

    expect(await screen.findByText(i18n.t('empty.noReleasesYet'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('home.emptyCatalogueDesc'))).toBeInTheDocument();
    expect(document.querySelectorAll('[data-track-id]')).toHaveLength(0);
    expect(screen.queryByText(i18n.t('empty.noArtistsToFeature'))).not.toBeInTheDocument();
  });

  it('renders real releases returned by the API', async () => {
    getTracks.mockResolvedValue([realTrack]);

    renderHome();

    expect(await screen.findByText(realTrack.title)).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('empty.noReleasesYet'))).not.toBeInTheDocument();
  });

  it('routes a genre chip to Discover with a taxonomy filter', async () => {
    const user = userEvent.setup();
    renderHome();

    const genreBrowser = screen.getByTestId('home-genre-browser');
    await user.click(within(genreBrowser).getByRole('button', { name: i18n.t('genres.hip_hop') }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/discover?genre=hip_hop');
  });

  it('renders product cards from the active locale', async () => {
    await i18n.changeLanguage('uk');
    renderHome();

    expect(screen.getByText(i18n.t('home.feat1Title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('home.feat4Desc'))).toBeInTheDocument();
    expect(screen.queryByText('Find your next sound')).not.toBeInTheDocument();
  });
});
