import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import Library from '../../src/pages/Library';
import { getFollowedArtists, getLikedTracks, getMyPlaylists } from '../../src/api';

vi.mock('../../src/api/mode', () => ({
  isMockMode: () => false,
}));

vi.mock('../../src/api', () => ({
  getArtists: vi.fn(),
  getFollowedArtists: vi.fn(),
  getLikedTracks: vi.fn(),
  getMyPlaylists: vi.fn(),
  getTracks: vi.fn(),
  createPlaylist: vi.fn(),
  setPlaylistSaved: vi.fn(),
}));

vi.mock('../../src/store/userStore', () => ({
  useUserStore: () => ({
    user: { id: 'listener-1', username: 'listener' },
    authHydrated: true,
    setAuthModalOpen: vi.fn(),
  }),
}));

vi.mock('../../src/store/playerStore', () => ({
  usePlayerStore: () => ({
    likedTracks: [],
    recentlyPlayed: [],
    recentlyPlayedError: null,
    loadRecentlyPlayed: vi.fn().mockResolvedValue(),
  }),
}));

vi.mock('../../src/components/tracks/TrackListItem', () => ({
  default: ({ track }) => <div data-testid={`library-track-${track.id}`}>{track.title}</div>,
}));

describe('Library Music / Beats separation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    getFollowedArtists.mockResolvedValue([]);
    getMyPlaylists.mockResolvedValue([]);
    getLikedTracks.mockResolvedValue([
      { id: 'music-1', title: 'Saved Song', contentType: 'MUSIC' },
      { id: 'beat-1', title: 'Saved Beat', contentType: 'BEAT' },
    ]);
  });

  it('shows each liked item once in its matching library tab', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/library?tab=beats']}>
        <Library />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('library-track-beat-1')).toHaveTextContent('Saved Beat');
    expect(screen.queryByTestId('library-track-music-1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: i18n.t('beats.likedMusic') }));
    await waitFor(() => {
      expect(screen.getByTestId('library-track-music-1')).toHaveTextContent('Saved Song');
    });
    expect(screen.queryByTestId('library-track-beat-1')).not.toBeInTheDocument();
  });
});
