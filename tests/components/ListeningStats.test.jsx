import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ListeningStats from '../../src/components/profile/ListeningStats';
import {
  EMPTY_LISTENING_STATS,
  useUserStore,
} from '../../src/store/userStore';

describe('ListeningStats', () => {
  it('does not render fabricated metrics when the API has no data', () => {
    useUserStore.setState({
      userListeningStats: { ...EMPTY_LISTENING_STATS },
      listeningStatsHydrated: true,
      listeningStatsError: null,
    });

    render(<ListeningStats />, { wrapper: MemoryRouter });

    expect(screen.getByText('Not enough listening data yet')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('labels playback starts without inventing measured listening time', () => {
    useUserStore.setState({
      userListeningStats: {
        ...EMPTY_LISTENING_STATS,
        tracksPlayed: 1,
        uniqueArtists: 1,
        topGenre: 'Ambient',
        topGenres: [{ genre: 'Ambient', percent: 100 }],
      },
      listeningStatsHydrated: true,
      listeningStatsError: null,
    });

    render(<ListeningStats />, { wrapper: MemoryRouter });

    expect(screen.getByText('No measured listening time yet')).toBeInTheDocument();
    expect(screen.getByText('Playback Starts')).toBeInTheDocument();
    expect(screen.queryByText('0h 0m')).not.toBeInTheDocument();
    expect(screen.getByText(/percentages are hidden/i)).toBeInTheDocument();
  });

  it('renders real topTracks and topArtists from the backend, not a placeholder', () => {
    useUserStore.setState({
      userListeningStats: {
        ...EMPTY_LISTENING_STATS,
        tracksPlayed: 4,
        uniqueArtists: 2,
        topGenre: 'Ambient',
        topGenres: [{ genre: 'Ambient', percent: 100 }],
        topTracks: [
          { track: { id: 't1', title: 'Low Orbit', genre: 'ambient', coverUrl: null }, playCount: 3 },
        ],
        topArtists: [
          { id: 'a1', name: 'Mira Vale', avatarUrl: null, playCount: 3 },
        ],
      },
      listeningStatsHydrated: true,
      listeningStatsError: null,
    });

    render(<ListeningStats />, { wrapper: MemoryRouter });

    expect(screen.getByText('Low Orbit')).toBeInTheDocument();
    expect(screen.getByText('Mira Vale')).toBeInTheDocument();
  });

  it('shows an honest empty state for top tracks/artists instead of fabricating entries', () => {
    useUserStore.setState({
      userListeningStats: {
        ...EMPTY_LISTENING_STATS,
        tracksPlayed: 1,
        uniqueArtists: 1,
        topGenres: [{ genre: 'Ambient', percent: 100 }],
        topTracks: [],
        topArtists: [],
      },
      listeningStatsHydrated: true,
      listeningStatsError: null,
    });

    render(<ListeningStats />, { wrapper: MemoryRouter });

    expect(screen.getByText('Your Top Tracks')).toBeInTheDocument();
    expect(screen.getByText('Your Top Artists')).toBeInTheDocument();
    expect(screen.getAllByText('Not enough listening data yet').length).toBeGreaterThanOrEqual(2);
  });
});
