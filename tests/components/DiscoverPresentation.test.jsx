import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import { getGroupOf, normalizeGenre, QUICK_GROUP_LABELS } from '../../src/constants/musicGenres';
import Discover from '../../src/pages/Discover';
import {
  useDiscoverPersonalization,
  useCatalogTracks,
  useCatalogSelection,
} from '../../src/hooks/queries/useTracks';
import { useArtistsWithTracks } from '../../src/hooks/queries/useArtists';
import { usePlayerStore } from '../../src/store/playerStore';
import { useUserStore } from '../../src/store/userStore';

vi.mock('../../src/hooks/queries/useTracks', () => ({
  useCatalogTracks: vi.fn(),
  useCatalogSelection: vi.fn(),
  useDiscoverPersonalization: vi.fn(),
}));

vi.mock('../../src/hooks/queries/useArtists', () => ({
  useArtistsWithTracks: vi.fn(),
}));

const music = {
  id: 'music-1',
  title: 'Unique Release',
  artistId: 'artist-1',
  artistName: 'Distinct Artist',
  contentType: 'MUSIC',
  genre: 'electronic',
  duration: 120,
  plays: 12,
  likes: 2,
  status: 'PUBLISHED',
  isStreamable: true,
  coverUrl: null,
  publishedAt: '2026-06-20T12:00:00.000Z',
};

const beat = {
  id: 'beat-1',
  title: 'Cold Circuit Beat',
  artistId: 'producer-1',
  artistName: 'Night Producer',
  contentType: 'BEAT',
  genre: 'hip_hop',
  duration: 138,
  plays: 24,
  likes: 4,
  status: 'PUBLISHED',
  isStreamable: true,
  coverUrl: null,
  publishedAt: '2026-07-20T12:00:00.000Z',
  beatBpm: 136,
  beatKey: 'C Minor',
  beatMood: 'Dark',
  beatStyle: 'Trap',
};

const artist = {
  id: 'artist-1',
  name: 'Distinct Artist',
  username: 'distinct_artist',
  genres: ['Electronic'],
  followers: 12,
  monthlyListeners: 8,
  avatarUrl: null,
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderDiscover(initialEntry = '/discover') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Discover />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function payload(items) {
  return { items, total: items.length, pageInfo: { hasNextPage: false, nextCursor: null, pageSize: 30 }, facets: { genres: [], groups: [], styles: [{ value: 'Trap', label: 'Trap', count: 1 }], moods: [{ value: 'Dark', label: 'Dark', count: 1 }], keys: [{ value: 'C Minor', label: 'C Minor', count: 1 }] }, meta: { trendingWindowDays: 7 } };
}
function mockSuccess({ tracks = [music, beat], creators = [artist] } = {}) {
  const serverItems = (options) => tracks.filter((track) => (!options.contentType || track.contentType === options.contentType)
    && (!options.group || getGroupOf(track.genre) === options.group)
    && (!options.genre || normalizeGenre(track.genre) === options.genre));
  useCatalogTracks.mockImplementation((options) => ({ data: { pages: [payload(serverItems(options))] }, isLoading: false, error: null, refetch: vi.fn(), fetchNextPage: vi.fn(), hasNextPage: false }));
  useCatalogSelection.mockImplementation((options) => ({ data: payload(serverItems(options)), isLoading: false, error: null, refetch: vi.fn() }));
  useDiscoverPersonalization.mockReturnValue({ data: undefined });
  useArtistsWithTracks.mockReturnValue({ data: creators, isLoading: false, error: null, refetch: vi.fn() });
}

describe('Discover catalog integration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    useUserStore.setState({ user: null });
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      likedTracks: [],
      recentlyPlayed: [],
      queue: [],
      originalQueue: [],
    });
    mockSuccess();
  });

  it('renders the distinct All information architecture from real catalogue data', () => {
    renderDiscover();

    expect(screen.getByRole('heading', { level: 1, name: i18n.t('discover.title') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('discover.subtitle'))).toBeInTheDocument();
    for (const testId of [
      'discover-trending',
      'discover-trending-week',
      'discover-new-releases',
      'discover-fresh-beats',
      'discover-creators',
      'discover-genre-tiles',
      'discover-all-content',
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('discover-style-tiles')).not.toBeInTheDocument();
  });

  it('renders Music copy and excludes Beats from every content surface', () => {
    renderDiscover('/discover?content=MUSIC');

    expect(screen.getByRole('heading', { level: 1, name: i18n.t('discover.musicTitle') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('discover.musicSubtitle'))).toBeInTheDocument();
    expect(screen.getAllByText('Unique Release').length).toBeGreaterThan(0);
    expect(screen.queryByText('Cold Circuit Beat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('discover-fresh-beats')).not.toBeInTheDocument();
    expect(screen.getByTestId('discover-genre-tiles')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: i18n.t('discover.music') })).toHaveAttribute('aria-selected', 'true');
  });

  it('hydrates server Beats requests from URL filters', () => {
    renderDiscover('/discover?content=BEAT&style=Trap&mood=Dark&bpm=120-149&key=C%20Minor&sort=played');

    expect(screen.getByRole('heading', { level: 1, name: i18n.t('discover.beatsTitle') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('discover.beatsSubtitle'))).toBeInTheDocument();
    const filters = screen.getByTestId('beat-discover-filters');
    expect(within(filters).getByTestId('beat-filter-style-trigger')).toHaveTextContent('Trap');
    expect(within(filters).getByTestId('beat-filter-bpm-trigger')).toHaveTextContent('120–149 BPM');
    expect(screen.getAllByText('Cold Circuit Beat').length).toBeGreaterThan(0);
    expect(screen.queryByText('Unique Release')).not.toBeInTheDocument();
    expect(screen.getByTestId('discover-style-tiles')).toBeInTheDocument();
    expect(screen.getByTestId('discover-mood-tiles')).toBeInTheDocument();
    expect(screen.queryByTestId('discover-new-releases')).not.toBeInTheDocument();
    expect(useCatalogTracks).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'BEAT',
      style: 'Trap',
      mood: 'Dark',
      bpm: '120-149',
      key: 'C Minor',
      sort: 'played',
      limit: 30,
    }));
  });

  it('writes custom Beat dropdown choices into canonical URL state', async () => {
    renderDiscover('/discover?content=BEAT');

    fireEvent.click(screen.getByTestId('beat-filter-bpm-trigger'));
    fireEvent.click(screen.getByRole('option', { name: '120–149 BPM' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('content=BEAT');
      expect(screen.getByTestId('location-search')).toHaveTextContent('bpm=120-149');
    });
    await waitFor(() => {
      expect(screen.getByTestId('beat-filter-bpm-trigger')).toHaveFocus();
    });
  });

  it('clears Beat-only filters when switching to Music while retaining search and sorting', async () => {
    renderDiscover('/discover?content=BEAT&q=night&style=Trap&bpm=120-149&sort=played');
    fireEvent.click(screen.getByRole('tab', { name: i18n.t('discover.music') }));
    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location-search').textContent);
      expect(params.get('content')).toBe('MUSIC');
      expect(params.get('q')).toBe('night');
      expect(params.get('sort')).toBe('played');
      expect(params.has('style')).toBe(false);
      expect(params.has('bpm')).toBe(false);
    });
  });

  it('shows Made for You only from the current account query signals', () => {
    useUserStore.setState({ user: { id: 'listener-1' } });
    mockSuccess({
      tracks: [music, { ...music, id: 'music-2', title: 'Account-scoped recommendation' }],
      creators: [artist],
    });
    useDiscoverPersonalization.mockReturnValue({
      data: { likedTracks: [music], recentlyPlayed: [] },
    });
    renderDiscover();

    expect(screen.getByTestId('discover-made-for-you')).toBeInTheDocument();
    expect(useDiscoverPersonalization).toHaveBeenCalledWith({
      userId: 'listener-1',
      contentType: 'ALL',
    });
  });

  it('keeps successful track sections visible when the creator request fails', () => {
    useArtistsWithTracks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Creator request failed'),
      refetch: vi.fn(),
    });
    renderDiscover();

    expect(screen.getAllByText('Unique Release').length).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t('discover.creatorsUnavailable'))).toBeInTheDocument();
  });

  it('keeps a successful Trending response visible when the catalogue request fails', () => {
    const catalogueFailure = new Error('Catalogue request failed');
    useCatalogTracks.mockReturnValue({ data: undefined, isLoading: false, error: catalogueFailure, refetch: vi.fn() });
    useCatalogSelection.mockReturnValue({ data: payload([music]), isLoading: false, error: null, refetch: vi.fn() });

    renderDiscover();

    expect(within(screen.getByTestId('discover-trending')).getByText('Unique Release'))
      .toBeInTheDocument();
    expect(within(screen.getByTestId('discover-all-content'))
      .getByText(i18n.t('discover.catalogueUnavailable'))).toBeInTheDocument();
  });

  it('applies the All-view genre group to Fresh beats', () => {
    const rockBeat = {
      ...beat,
      id: 'beat-rock',
      title: 'Rock Session Beat',
      genre: 'rock',
      beatStyle: 'Experimental',
    };
    mockSuccess({ tracks: [music, beat, rockBeat], creators: [artist] });

    renderDiscover('/discover?group=rock');

    const freshBeats = screen.getByTestId('discover-fresh-beats');
    expect(within(freshBeats).getByText('Rock Session Beat')).toBeInTheDocument();
    expect(within(freshBeats).queryByText('Cold Circuit Beat')).not.toBeInTheDocument();
  });

  it('supports the horizontal ARIA tab keyboard pattern', async () => {
    renderDiscover();
    const allTab = screen.getByRole('tab', { name: i18n.t('discover.all') });
    const musicTab = screen.getByRole('tab', { name: i18n.t('discover.music') });

    allTab.focus();
    fireEvent.keyDown(allTab, { key: 'ArrowRight' });

    await waitFor(() => expect(musicTab).toHaveFocus());
    expect(musicTab).toHaveAttribute('tabindex', '0');
    expect(allTab).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('location-search')).toHaveTextContent('content=MUSIC');
  });

  it('announces a genre chip as a clear-filter action', () => {
    renderDiscover('/discover?group=rock');

    expect(screen.getByTestId('active-genre-chip')).toHaveAccessibleName(
      `${i18n.t('discover.clearFilter')}: ${QUICK_GROUP_LABELS.rock}`,
    );
  });

  it('shows truthful empty states and never invents catalogue cards', () => {
    mockSuccess({ tracks: [], creators: [] });
    renderDiscover();

    expect(screen.getAllByText(i18n.t('discover.noReleasesMatch')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: i18n.t('discover.uploadFirstTrack') })).toBeInTheDocument();
    expect(screen.queryByText('Nightcrawler')).not.toBeInTheDocument();
  });
});
