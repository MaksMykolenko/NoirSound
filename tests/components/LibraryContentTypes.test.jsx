import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import Library from '../../src/pages/Library';
import LibrarySidebarSection from '../../src/components/layout/LibrarySidebarSection';
import { getFollowedArtists, getLikedTracks, getMyPlaylists } from '../../src/api';

const stores = vi.hoisted(() => ({
  user: { user: { id: 'listener-1', username: 'listener' }, authHydrated: true, setAuthModalOpen: vi.fn() },
  player: { likedTracks: ['music-1', 'beat-1'], recentlyPlayed: [], recentlyPlayedError: null, loadRecentlyPlayed: vi.fn().mockResolvedValue() },
}));

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
  useUserStore: () => stores.user,
}));

vi.mock('../../src/store/playerStore', () => ({
  usePlayerStore: () => stores.player,
}));

vi.mock('../../src/components/tracks/TrackListItem', () => ({
  default: ({ track }) => <div data-testid={`library-track-${track.id}`}>{track.title}</div>,
}));

describe('Library Music / Beats separation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    stores.player.likedTracks = ['music-1', 'beat-1'];
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

  it('shows one liked shortcut with a breakdown and opens both content types', async () => {
    await i18n.changeLanguage('uk');
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/library?tab=liked']}><LibrarySidebarSection /><Library /></MemoryRouter>);
    const liked = screen.getByTestId('library-shortcut-liked');
    expect(screen.queryByTestId('library-shortcut-music')).not.toBeInTheDocument();
    expect(screen.queryByTestId('library-shortcut-beats')).not.toBeInTheDocument();
    expect(await within(liked).findByText('Музика: 1')).toBeInTheDocument();
    expect(await within(liked).findByText('Біти: 1')).toBeInTheDocument();
    expect(await screen.findByTestId('library-track-music-1')).toBeInTheDocument();
    expect(await screen.findByTestId('library-track-beat-1')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: i18n.t('beats.likedBeats') }));
    expect(await screen.findByTestId('library-track-beat-1')).toBeInTheDocument();
    expect(screen.queryByTestId('library-track-music-1')).not.toBeInTheDocument();
    await user.click(liked);
    expect(await screen.findByTestId('library-track-music-1')).toBeInTheDocument();
    expect(await screen.findByTestId('library-track-beat-1')).toBeInTheDocument();
  });

  it('refreshes both the count and visible rows after a successful unlike', async () => {
    const ui = <MemoryRouter initialEntries={['/library?tab=music']}><LibrarySidebarSection /><Library /></MemoryRouter>;
    const { rerender } = render(ui);
    expect(await screen.findByTestId('library-track-music-1')).toBeInTheDocument();
    getLikedTracks.mockResolvedValue([{ id: 'beat-1', title: 'Saved Beat', contentType: 'BEAT' }]);
    stores.player.likedTracks = ['beat-1'];
    rerender(<MemoryRouter initialEntries={['/library?tab=music']}><LibrarySidebarSection /><Library /></MemoryRouter>);
    expect(await within(screen.getByTestId('library-shortcut-liked')).findByText('Music: 0')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('library-track-music-1')).not.toBeInTheDocument());
    expect(within(screen.getByTestId('library-shortcut-liked')).getByText('Beats: 1')).toBeInTheDocument();
  });
});
