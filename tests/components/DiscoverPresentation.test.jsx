import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import Discover from '../../src/pages/Discover';
import { useDiscoverTracks } from '../../src/hooks/queries/useTracks';
import { useArtistsWithTracks } from '../../src/hooks/queries/useArtists';

vi.mock('../../src/hooks/queries/useTracks', () => ({
  useDiscoverTracks: vi.fn(),
}));

vi.mock('../../src/hooks/queries/useArtists', () => ({
  useArtistsWithTracks: vi.fn(),
}));

const playableTrack = {
  id: 'track-1',
  title: 'Unique Release',
  artistId: 'artist-1',
  artistName: 'Distinct Artist',
  genre: 'Electronic',
  duration: 120,
  plays: 0,
  likes: 0,
  status: 'PUBLISHED',
  isStreamable: true,
  coverUrl: null,
  releaseDate: '2026-06-20',
};

const artist = {
  id: 'artist-1',
  name: 'Distinct Artist',
  username: 'distinct_artist',
  genres: ['Electronic'],
  followers: 0,
  avatarUrl: null,
};

describe('Discover real-data presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates Featured tracks and Recommended Artists by id', () => {
    useDiscoverTracks.mockReturnValue({
      data: [playableTrack, { ...playableTrack }],
      isLoading: false,
      error: null,
    });
    useArtistsWithTracks.mockReturnValue({
      data: [artist, { ...artist }],
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <Discover />
      </MemoryRouter>
    );

    const featured = screen.getByTestId('featured-tracks');
    const allReleases = screen.getByTestId('all-releases');
    const recommended = screen.getByTestId('recommended-artists');
    expect(within(featured).getAllByRole('link')).toHaveLength(1);
    expect(within(allReleases).getAllByRole('link')).toHaveLength(1);
    expect(within(recommended).getAllByText('Distinct Artist')).toHaveLength(1);
  });

  it('shows an upload empty state instead of invented cards', () => {
    useDiscoverTracks.mockReturnValue({ data: [], isLoading: false, error: null });
    useArtistsWithTracks.mockReturnValue({ data: [], isLoading: false, error: null });

    render(
      <MemoryRouter>
        <Discover />
      </MemoryRouter>
    );

    expect(screen.getAllByText(i18n.t('empty.noReleasesYet')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: i18n.t('discover.uploadFirstTrack') })).toBeInTheDocument();
    expect(screen.queryByText('Nightcrawler')).not.toBeInTheDocument();
  });
});
