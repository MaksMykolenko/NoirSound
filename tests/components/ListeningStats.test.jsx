import React from 'react';
import { render, screen } from '@testing-library/react';
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

    render(<ListeningStats />);

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

    render(<ListeningStats />);

    expect(screen.getByText('No measured listening time yet')).toBeInTheDocument();
    expect(screen.getByText('Playback Starts')).toBeInTheDocument();
    expect(screen.queryByText('0h 0m')).not.toBeInTheDocument();
    expect(screen.getByText(/percentages are hidden/i)).toBeInTheDocument();
  });
});
