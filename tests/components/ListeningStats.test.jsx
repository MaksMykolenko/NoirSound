import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, afterEach } from 'vitest';
import i18n from '../../src/i18n';
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

  describe('genre labels stay English regardless of UI language', () => {
    afterEach(async () => {
      await i18n.changeLanguage('en');
    });

    it.each(['uk', 'pl', 'ru'])('top genre + breakdown render in English under %s UI', async (lng) => {
      await i18n.changeLanguage(lng);
      useUserStore.setState({
        userListeningStats: {
          ...EMPTY_LISTENING_STATS,
          tracksPlayed: 10,
          uniqueArtists: 3,
          topGenre: 'hip_hop',
          topGenres: [
            { genre: 'hip_hop', percent: 60 },
            { genre: 'electronic', percent: 40 },
          ],
        },
        listeningStatsHydrated: true,
        listeningStatsError: null,
      });

      render(<ListeningStats />, { wrapper: MemoryRouter });

      // "Hip-Hop" appears twice (top-genre stat card + breakdown bar) —
      // assert presence, not uniqueness.
      expect(screen.getAllByText('Hip-Hop').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Electronic').length).toBeGreaterThan(0);
      expect(screen.queryByText('Хіп-хоп')).not.toBeInTheDocument();
      expect(screen.queryByText('Електроніка')).not.toBeInTheDocument();
    });
  });
});
