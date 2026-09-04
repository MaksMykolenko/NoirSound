import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import Home from '../../src/pages/Home';
import { getArtistsWithTracks, getCatalogTracks } from '../../src/api';

vi.mock('../../src/api', () => ({
  getCatalogTracks: vi.fn(),
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

function mockCatalog(music = [], beats = []) {
  getCatalogTracks.mockImplementation(({ contentType }) => Promise.resolve({
    items: contentType === 'BEAT' ? beats : music,
    total: contentType === 'BEAT' ? beats.length : music.length,
    pageInfo: { hasNextPage: false, nextCursor: null, pageSize: 8 },
  }));
}

describe('Home real API states', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    mockCatalog();
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
    mockCatalog([realTrack]);

    renderHome();

    expect(await screen.findByRole('heading', { level: 3, name: realTrack.title })).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('empty.noReleasesYet'))).not.toBeInTheDocument();
  });

  it('keeps Music and Beats in separate Home sections while sharing normal track cards', async () => {
    const music = { ...realTrack, id: 'music-1', title: 'Finished Song', contentType: 'MUSIC' };
    const beat = {
      ...realTrack,
      id: 'beat-1',
      title: 'Midnight Beat',
      contentType: 'BEAT',
      beatBpm: 138,
      beatKey: 'D Minor',
    };
    mockCatalog([music], [beat]);

    renderHome();

    const musicSection = await screen.findByTestId('home-releases');
    const beatSection = screen.getByTestId('home-fresh-beats');
    expect(within(musicSection).getByText('Finished Song')).toBeInTheDocument();
    expect(within(musicSection).queryByText('Midnight Beat')).not.toBeInTheDocument();
    expect(within(beatSection).getByText('Midnight Beat')).toBeInTheDocument();
    expect(within(beatSection).queryByText('Finished Song')).not.toBeInTheDocument();
    expect(within(beatSection).getByTestId('beat-badge')).toBeInTheDocument();
    expect(within(beatSection).getByText(/138 BPM/)).toBeInTheDocument();
  });

  it.each([1, 2, 8])('renders all %i returned releases without placeholders', async (count) => {
    const tracks = Array.from({ length: count }, (_, index) => makeTrack(index + 1));
    mockCatalog(tracks);

    renderHome();

    await screen.findByText(tracks.at(-1).title);
    const grid = screen.getByTestId('home-release-grid');
    const cards = grid.querySelectorAll('[data-track-id]');

    expect(cards).toHaveLength(count);
  });

  it('requests independently bounded Music and Beat selections and preserves server order', async () => {
    const tracks = [makeTrack(3), makeTrack(1), makeTrack(2)];
    mockCatalog(tracks);
    renderHome();
    await screen.findByText(tracks.at(-1).title);
    expect(getCatalogTracks).toHaveBeenCalledWith(
      { contentType: 'MUSIC', sort: 'recent', limit: 8 }, { signal: expect.any(AbortSignal) },
    );
    expect(getCatalogTracks).toHaveBeenCalledWith(
      { contentType: 'BEAT', sort: 'recent', limit: 8 }, { signal: expect.any(AbortSignal) },
    );
    const cards = [...screen.getByTestId('home-release-grid').querySelectorAll('[data-track-id]')];
    expect(cards.map((card) => card.getAttribute('data-track-id'))).toEqual(tracks.map((track) => track.id));
  });

  it.each([
    ['home-releases', 'MUSIC'],
    ['home-fresh-beats', 'BEAT'],
  ])('routes %s View All to the matching complete catalog selection', async (sectionId, contentType) => {
    const user = userEvent.setup();
    renderHome();
    const section = screen.getByTestId(sectionId);
    await user.click(within(section).getByRole('button', { name: i18n.t('home.exploreAll') }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent(`/discover?content=${contentType}&sort=recent`);
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

  it('renders the Beats info showcase card and routes discover action', async () => {
    const user = userEvent.setup();
    renderHome();

    const card = screen.getByTestId('home-beats-info-card');
    expect(card).toBeInTheDocument();
    expect(within(card).getByText(i18n.t('beats.homeInfoTitle'))).toBeInTheDocument();
    expect(within(card).getByText(i18n.t('beats.homeInfoFeat1Title'))).toBeInTheDocument();

    const discoverBtn = screen.getByTestId('home-beats-info-discover');
    await user.click(discoverBtn);
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/discover?content=BEAT');
  });

  it('routes upload action from Beats info card', async () => {
    const user = userEvent.setup();
    renderHome();

    const uploadBtn = screen.getByTestId('home-beats-info-upload');
    await user.click(uploadBtn);
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/upload');
  });
});
