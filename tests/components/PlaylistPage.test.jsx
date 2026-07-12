import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import {
  getPlaylistById,
  getMyPlaylists,
  removeTrackFromPlaylist,
} from '../../src/api/playlists';
import { usePlayerStore } from '../../src/store/playerStore';
import ContextMenuProvider from '../../src/components/context-menu/ContextMenuProvider';
import { formatDuration, formatDurationLong } from '../../src/utils/formatTime';
import { formatDate } from '../../src/utils/formatLocale';

// This suite mocks the API one layer below the page (src/api/playlists)
// rather than the barrel (src/api/index). Both src/api/index.js
// (`export * from './playlists'`) and the hooks/context-menu code that
// import directly from `../api/playlists` resolve to this exact file, so a
// single mock here covers every call site PlaylistPage's tree can reach.
vi.mock('../../src/api/playlists', () => ({
  getPlaylists: vi.fn(),
  getPlaylistById: vi.fn(),
  createPlaylist: vi.fn(),
  getMyPlaylists: vi.fn().mockResolvedValue([]),
  updatePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  addTrackToPlaylist: vi.fn(),
  removeTrackFromPlaylist: vi.fn(),
  reorderPlaylistTracks: vi.fn(),
  setPlaylistSaved: vi.fn(),
  uploadPlaylistCover: vi.fn(),
}));

import PlaylistPage from '../../src/pages/PlaylistPage';

// --- Fixtures --------------------------------------------------------
// Shaped as the mapper's *output* (what the UI actually consumes), since
// getPlaylistById is mocked directly -- the mapper layer itself already has
// its own coverage and isn't re-tested here.
const trackA = {
  id: 't-a', playlistTrackId: 'pt-a', position: 0, addedAt: '2026-06-01', addedBy: 'DJ Nova',
  title: 'Neon Static', artistId: 'artist-a', artistName: 'DJ Nova',
  albumTitle: 'Night Circuits', albumId: 'album-a', releaseTitle: null, releasePlaylistId: null,
  coverUrl: null, durationSeconds: 245, duration: 245, explicit: false, genre: 'phonk',
  isLiked: false, hasLyrics: true, status: 'PUBLISHED', isAvailable: true, isStreamable: true,
  audioUrl: 'http://example.test/a',
};
const trackB = {
  id: 't-b', playlistTrackId: 'pt-b', position: 1, addedAt: '2026-06-05', addedBy: 'DJ Nova',
  title: 'Chrome Heart', artistId: 'artist-b', artistName: 'Vess',
  albumTitle: null, albumId: null, releaseTitle: 'Chrome Sessions EP', releasePlaylistId: 'release-playlist-1',
  coverUrl: null, durationSeconds: 190, duration: 190, explicit: true, genre: 'trap',
  isLiked: true, hasLyrics: false, status: 'PUBLISHED', isAvailable: true, isStreamable: true,
  audioUrl: 'http://example.test/b',
};
const trackC = {
  id: 't-c', playlistTrackId: 'pt-c', position: 2, addedAt: '2026-06-10', addedBy: 'DJ Nova',
  title: 'Afterglow', artistId: 'artist-c', artistName: 'Lumen',
  albumTitle: null, albumId: null, releaseTitle: null, releasePlaylistId: null,
  coverUrl: null, durationSeconds: 200, duration: 200, explicit: false, genre: 'ambient',
  isLiked: false, hasLyrics: false, status: 'PUBLISHED', isAvailable: true, isStreamable: true,
  audioUrl: 'http://example.test/c',
};
// Simulates exactly what the backend sends for a hidden/private track: the
// availability flag plus an id, nothing else -- the component must never
// assume title/artist/cover exist on an unavailable row.
const trackD = {
  id: 't-d', playlistTrackId: 'pt-d', position: 3, addedAt: null, addedBy: null,
  isAvailable: false,
};

function buildPlaylist(overrides = {}) {
  return {
    id: 'pl-1',
    name: 'Late Night Circuit',
    description: 'Music for 3am drives.',
    creator: 'DJ Nova',
    ownerArtistId: 'artist-a',
    isPublic: true,
    isOwner: false,
    isSaved: false,
    likes: 12,
    updatedAt: '2026-06-20',
    coverUrl: null,
    tracks: [trackA, trackB, trackC, trackD],
    ...overrides,
  };
}

// The like/unlike aria-label is a runtime template, not a single i18n key;
// mirror it exactly instead of hardcoding a translated string in the test.
const likeLabel = (title, liked) => `${i18n.t(liked ? 'trackPage.unlike' : 'trackPage.like')} ${title}`;

function resetPlayerStore(overrides = {}) {
  usePlayerStore.setState({
    currentTrack: null,
    isPlaying: false,
    likedTracks: [],
    queue: [],
    originalQueue: [],
    queueSource: null,
    playTrack: vi.fn(),
    togglePlay: vi.fn(),
    toggleLikeTrack: vi.fn(),
    addTracksToQueue: vi.fn(),
    addToQueue: vi.fn(),
    playNext: vi.fn(),
    ...overrides,
  });
}

function renderPlaylistPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/playlist/pl-1']}>
        <ContextMenuProvider>
          <Routes>
            <Route path="/playlist/:id" element={<PlaylistPage />} />
          </Routes>
        </ContextMenuProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PlaylistPage — playlist detail table', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    getMyPlaylists.mockResolvedValue([]);
    resetPlayerStore();
  });

  afterEach(cleanup);

  describe('header', () => {
    it('renders type label, visibility, description, creator, saves, and updated date', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      expect(screen.getByText(i18n.t('playlists.typeLabel'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('playlists.public'))).toBeInTheDocument();
      expect(screen.getByText('Music for 3am drives.')).toBeInTheDocument();
      expect(screen.getByText(i18n.t('playlists.by', { creator: 'DJ Nova' }))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('playlists.saves', { count: 12 }))).toBeInTheDocument();
      const expectedUpdated = i18n.t('playlists.updated', {
        date: new Date('2026-06-20').toLocaleDateString(i18n.language),
      });
      expect(screen.getByText(expectedUpdated)).toBeInTheDocument();
    });

    it('shows Edit for the owner and hides Save', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      expect(screen.getByRole('button', { name: i18n.t('playlists.edit') })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('playlists.save') })).not.toBeInTheDocument();
    });

    it('shows Save for non-owners and hides Edit', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: false }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      expect(screen.getByRole('button', { name: i18n.t('playlists.save') })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('playlists.edit') })).not.toBeInTheDocument();
    });
  });

  describe('desktop track table', () => {
    it('renders the spec-required desktop columns', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      const headerRow = within(table).getAllByRole('row')[0];
      expect(within(headerRow).getByText('#')).toBeInTheDocument();
      expect(within(headerRow).getByText(i18n.t('playlists.columnTitle'))).toBeInTheDocument();
      expect(within(headerRow).getByText(i18n.t('playlists.columnAlbum'))).toBeInTheDocument();
      expect(within(headerRow).getByText(i18n.t('playlists.columnDateAdded'))).toBeInTheDocument();
      expect(within(headerRow).getByText(i18n.t('playlists.columnDuration'))).toBeInTheDocument();
    });

    it('resolves the album/release/Single fallback chain per track', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      // Real album: shown, never linked (there is no album page anywhere).
      expect(within(table).getByText('Night Circuits')).toBeInTheDocument();
      expect(within(table).queryByRole('button', { name: 'Night Circuits' })).not.toBeInTheDocument();
      // No album, but a batch-upload release playlist exists: shown as a link.
      expect(within(table).getByRole('button', { name: 'Chrome Sessions EP' })).toBeInTheDocument();
      // Neither album nor release: falls back to "Single".
      expect(within(table).getByText(i18n.t('playlists.single'))).toBeInTheDocument();
    });

    it('formats date added and per-row duration with the shared formatters', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      const rowA = within(table).getByText('Neon Static').closest('tr');
      expect(within(rowA).getByText(
        formatDate('2026-06-01', { month: 'short', day: 'numeric', year: 'numeric' })
      )).toBeInTheDocument();
      expect(within(rowA).getByText(formatDuration(245))).toBeInTheDocument();
    });

    it('formats the header track count and total duration', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      // 4 tracks loaded (unavailable track included, matching what the page
      // actually renders); total duration only sums the 3 tracks that carry
      // a real duration (245 + 190 + 200 = 635s).
      expect(screen.getByText(i18n.t('playlists.tracksCount', { count: 4 }))).toBeInTheDocument();
      expect(screen.getByText(formatDurationLong(635, i18n.t.bind(i18n)))).toBeInTheDocument();
    });
  });

  describe('playback integration', () => {
    it('starts the queue from the clicked row, excluding unavailable tracks', async () => {
      const playTrack = vi.fn();
      resetPlayerStore({ playTrack });
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      const playButton = within(table).getByLabelText(
        i18n.t('playlists.playFromHere', { title: 'Neon Static' })
      );
      fireEvent.click(playButton);

      expect(playTrack).toHaveBeenCalledTimes(1);
      const [track, queue, source] = playTrack.mock.calls[0];
      expect(track.id).toBe('t-a');
      expect(queue.map((item) => item.id)).toEqual(['t-a', 't-b', 't-c']);
      expect(source).toEqual({ type: 'playlist', id: 'pl-1', name: 'Late Night Circuit' });
    });

    it('highlights the currently playing row and exposes a pause control', async () => {
      resetPlayerStore({ currentTrack: { id: 't-a' }, isPlaying: true });
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      const row = within(table).getByText('Neon Static').closest('tr');
      expect(row).toHaveAttribute('aria-current', 'true');
      expect(within(row).getByLabelText(
        i18n.t('playlists.pauseTrack', { title: 'Neon Static' })
      )).toBeInTheDocument();
      expect(within(row).getByText(i18n.t('playlists.currentlyPlaying'))).toHaveClass('sr-only');
    });

    it('queues all playable tracks from the header Add to queue button', async () => {
      const addTracksToQueue = vi.fn();
      resetPlayerStore({ addTracksToQueue });
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      fireEvent.click(screen.getByRole('button', { name: i18n.t('playlists.addToQueue') }));

      expect(addTracksToQueue).toHaveBeenCalledTimes(1);
      expect(addTracksToQueue.mock.calls[0][0].map((item) => item.id)).toEqual(['t-a', 't-b', 't-c']);
    });
  });

  describe('like button', () => {
    it('reflects liked state from the player store and toggles a like on click', async () => {
      const toggleLikeTrack = vi.fn();
      resetPlayerStore({ likedTracks: ['t-b'], toggleLikeTrack });
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      const likedButton = within(table).getByLabelText(likeLabel('Chrome Heart', true));
      expect(likedButton).toHaveAttribute('aria-pressed', 'true');

      const unlikedButton = within(table).getByLabelText(likeLabel('Neon Static', false));
      fireEvent.click(unlikedButton);
      expect(toggleLikeTrack).toHaveBeenCalledWith('t-a');
    });
  });

  describe('context menu', () => {
    it('opens the track menu on right-click with owner-scoped actions', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      const row = within(table).getByText('Neon Static').closest('tr');
      fireEvent.contextMenu(row, { clientX: 20, clientY: 20 });

      const menu = screen.getByRole('menu');
      expect(within(menu).getByText(i18n.t('contextMenu.removeFromPlaylist'))).toBeInTheDocument();
      expect(within(menu).getByText(i18n.t('contextMenu.addToPlaylist'))).toBeInTheDocument();
    });

    it('opens the track menu from the more button and hides Remove for non-owners', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: false }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      const moreButton = within(table).getByLabelText(
        i18n.t('playlists.moreActionsFor', { title: 'Neon Static' })
      );
      fireEvent.click(moreButton);

      const menu = screen.getByRole('menu');
      expect(within(menu).queryByText(i18n.t('contextMenu.removeFromPlaylist'))).not.toBeInTheDocument();
    });

    it('opens the playlist header menu with owner actions', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      fireEvent.click(screen.getByLabelText('More actions for Late Night Circuit'));

      const menu = screen.getByRole('menu');
      expect(within(menu).getByText(i18n.t('contextMenu.editPlaylist'))).toBeInTheDocument();
      expect(within(menu).getByText(i18n.t('contextMenu.deletePlaylist'))).toBeInTheDocument();
    });
  });

  describe('owner controls', () => {
    it('shows reorder buttons in custom order and disables them once sorted', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      expect(within(table).getByLabelText(
        i18n.t('playlists.moveTrackUp', { title: 'Chrome Heart' })
      )).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: i18n.t('playlists.sortByTitle') }));

      expect(within(table).queryByLabelText(
        i18n.t('playlists.moveTrackUp', { title: 'Chrome Heart' })
      )).not.toBeInTheDocument();
      expect(screen.getByText(i18n.t('playlists.reorderDisabledWhileSorted'))).toBeInTheDocument();
    });

    it('never shows reorder buttons to non-owners', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: false }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      expect(within(table).queryByLabelText(
        i18n.t('playlists.moveTrackUp', { title: 'Chrome Heart' })
      )).not.toBeInTheDocument();
    });

    it('confirms before removing a track and only calls the API on confirm', async () => {
      removeTrackFromPlaylist.mockResolvedValue({});
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      fireEvent.click(within(table).getByLabelText(
        i18n.t('playlists.moreActionsFor', { title: 'Neon Static' })
      ));
      fireEvent.click(screen.getByText(i18n.t('contextMenu.removeFromPlaylist')));
      expect(removeTrackFromPlaylist).not.toHaveBeenCalled();

      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText(
        i18n.t('playlists.removeTrackConfirm', { title: 'Neon Static' })
      )).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('playlists.removeTrack') }));

      await waitFor(() => expect(removeTrackFromPlaylist).toHaveBeenCalledWith('pl-1', 't-a'));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(screen.queryByText('Neon Static')).not.toBeInTheDocument();
    });
  });

  describe('mobile layout', () => {
    it('renders a parallel mobile row list alongside the desktop table', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      const { container } = renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      expect(within(table).getAllByRole('row')).toHaveLength(5); // 1 header + 4 tracks

      const mobileLists = Array.from(container.querySelectorAll('.md\\:hidden'))
        .filter((el) => el.querySelector('[data-track-id]'));
      expect(mobileLists).toHaveLength(1);
      expect(mobileLists[0].querySelectorAll('[data-track-id]')).toHaveLength(4);
    });

    it('keeps mobile rows to play and More while preserving secondary context actions', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      const { container } = renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const mobileList = Array.from(container.querySelectorAll('.md\\:hidden'))
        .find((element) => element.querySelector('[data-track-id="t-a"]'));
      const mobileRow = mobileList.querySelector('[data-track-id="t-a"]');

      expect(within(mobileRow).getByRole('button', {
        name: i18n.t('playlists.playFromHere', { title: trackA.title }),
      })).toBeInTheDocument();
      expect(within(mobileRow).queryByRole('button', {
        name: likeLabel(trackA.title, false),
      })).not.toBeInTheDocument();

      fireEvent.click(within(mobileRow).getByRole('button', {
        name: i18n.t('playlists.moreActionsFor', { title: trackA.title }),
      }));

      const menu = screen.getByRole('menu');
      expect(within(menu).getByText(i18n.t('contextMenu.likeTrack'))).toBeInTheDocument();
      expect(within(menu).getByText(i18n.t('contextMenu.addToQueue'))).toBeInTheDocument();
      expect(within(menu).getByText(i18n.t('contextMenu.addToPlaylist'))).toBeInTheDocument();
      expect(within(menu).getByText(i18n.t('contextMenu.removeFromPlaylist'))).toBeInTheDocument();
    });
  });

  describe('empty and unavailable states', () => {
    it('shows the empty state when the playlist has no tracks', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true, tracks: [] }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      expect(screen.getByText(i18n.t('playlists.empty'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('playlists.emptyOwner'))).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows a safe placeholder for unavailable tracks without exposing track data', async () => {
      getPlaylistById.mockResolvedValue(buildPlaylist({ isOwner: true }));
      renderPlaylistPage();
      await screen.findByText('Late Night Circuit');

      const table = screen.getByRole('table');
      const unavailableRow = table.querySelector('tr[data-track-id="t-d"]');
      expect(unavailableRow).toBeTruthy();
      expect(within(unavailableRow).getByText(i18n.t('playlists.trackUnavailable'))).toBeInTheDocument();
      // No play control and no like control -- both are gated on isAvailable
      // so an unavailable row can never expose a play/like affordance for
      // data the viewer isn't allowed to see. Move/more buttons are still
      // fine (they don't leak track content), so this checks specifically
      // for play/pause/like rather than "zero buttons".
      expect(within(unavailableRow).queryByRole('button', { name: /play|pause/i })).not.toBeInTheDocument();
      expect(within(unavailableRow).queryByRole('button', { name: /like/i })).not.toBeInTheDocument();
      expect(unavailableRow).toHaveClass('opacity-50');
    });
  });
});
