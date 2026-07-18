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

function makeTrack(index) {
  return {
    ...realTrack,
    id: `track-${index}`,
    title: `Real API Release ${index}`,
    releaseDate: new Date(Date.UTC(2026, 0, index)).toISOString(),
  };
}

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

    expect(await screen.findByRole('heading', { level: 3, name: realTrack.title })).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('empty.noReleasesYet'))).not.toBeInTheDocument();
  });

  it.each([1, 2, 8])('keeps %i real release cards bounded in the responsive Home grid', async (count) => {
    const tracks = Array.from({ length: count }, (_, index) => makeTrack(index + 1));
    getTracks.mockResolvedValue(tracks);

    renderHome();

    await screen.findByText(tracks.at(-1).title);
    const grid = screen.getByTestId('home-release-grid');
    const cards = grid.querySelectorAll('[data-track-id]');

    expect(cards).toHaveLength(count);
    expect(grid.className).toContain(
      'sm:[grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]'
    );
    expect(cards[0].parentElement.className).toContain('sm:max-w-[17.5rem]');
    expect(cards[0].parentElement.className).toContain('sm:justify-self-start');
  });

  it('shows at most eight real releases from a larger catalogue', async () => {
    const tracks = Array.from({ length: 9 }, (_, index) => makeTrack(index + 1));
    getTracks.mockResolvedValue(tracks);

    renderHome();

    await screen.findByText(tracks.at(-1).title);
    expect(screen.getByTestId('home-release-grid').querySelectorAll('[data-track-id]')).toHaveLength(8);
  });

  it('routes a genre chip to Discover with a taxonomy filter', async () => {
    const user = userEvent.setup();
    renderHome();

    // Genre chip text is English by design (never an i18n lookup) — see
    // NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md.
    const genreBrowser = screen.getByTestId('home-genre-browser');
    await user.click(within(genreBrowser).getByRole('button', { name: 'Hip-Hop' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/discover?genre=hip_hop');
  });

  it('renders the localized music-first hero without the removed product-card strip', async () => {
    await i18n.changeLanguage('uk');
    renderHome();

    expect(screen.getByText(i18n.t('home.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('home.subtitle'))).toBeInTheDocument();
    expect(screen.queryByTestId('home-features')).not.toBeInTheDocument();
    expect(screen.queryByText('Find your next sound')).not.toBeInTheDocument();
  });

  it('keeps Browse-by-Genre chips in English under a non-English UI language', async () => {
    await i18n.changeLanguage('uk');
    renderHome();

    const genreBrowser = screen.getByTestId('home-genre-browser');
    expect(within(genreBrowser).getByRole('button', { name: 'Hip-Hop' })).toBeInTheDocument();
    expect(within(genreBrowser).getByRole('button', { name: 'Electronic' })).toBeInTheDocument();
    expect(within(genreBrowser).getByRole('button', { name: 'World' })).toBeInTheDocument();
    expect(within(genreBrowser).queryByText('Електроніка')).not.toBeInTheDocument();
    expect(within(genreBrowser).queryByText('Світова')).not.toBeInTheDocument();

    await i18n.changeLanguage('en');
  });
});
