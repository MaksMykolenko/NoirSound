import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter, Link, MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '../../src/i18n';
import LyricsEditor from '../../src/components/lyrics/LyricsEditor';
import TrackLyricsCard from '../../src/components/lyrics/TrackLyricsCard';
import AppLayout from '../../src/components/layout/AppLayout';
import PlayerBar from '../../src/components/player/PlayerBar';
import FullscreenLyricsPlayer from '../../src/components/player/FullscreenLyricsPlayer';
import { PlaybackErrorStatus } from '../../src/components/player/PlayerBarShared';
import { clearFullscreenLyricsCache } from '../../src/components/player/fullscreenLyricsCache';
import { __getAudioElementForTests, usePlayerStore } from '../../src/store/playerStore';
import { getTrackLyrics } from '../../src/api/lyrics';
import { resolvePlaybackErrorMessage } from '../../src/utils/playbackErrorMessage';

vi.mock('../../src/api/lyrics', () => ({
  getTrackLyrics: vi.fn(),
  getManageTrackLyrics: vi.fn(),
  updateTrackLyrics: vi.fn(),
}));

const track = {
  id: 'lyrics-track',
  title: 'Midnight Words',
  artistId: 'artist-1',
  artistName: 'Noir Artist',
  genre: 'electronic',
  coverUrl: null,
  duration: 180,
  isStreamable: true,
  hasLyrics: true,
  lyricsType: 'PLAIN',
};
const originalPlayerActions = {
  togglePlay: usePlayerStore.getState().togglePlay,
  seek: usePlayerStore.getState().seek,
  setVolume: usePlayerStore.getState().setVolume,
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="lyrics-player-route">{location.pathname}</output>;
}

function HistoryRouteFixture() {
  const location = useLocation();
  return (
    <>
      {location.pathname === '/history-seed' && (
        <Link to="/discover">Open history route A</Link>
      )}
      <LocationProbe />
    </>
  );
}

const originalMatchMedia = window.matchMedia;

function useMobileViewport() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query) => ({
      matches: query === '(max-width: 1023px)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function PlayerLyricsFixture() {
  const lyricsFullscreenOpen = usePlayerStore((state) => state.lyricsFullscreenOpen);
  const [isQueueOpen, setIsQueueOpen] = React.useState(false);
  return (
    <MemoryRouter>
      <PlayerBar onToggleQueue={() => setIsQueueOpen((open) => !open)} isQueueOpen={isQueueOpen} />
      {lyricsFullscreenOpen && (
        <FullscreenLyricsPlayer
          isQueueOpen={isQueueOpen}
          onToggleQueue={() => setIsQueueOpen((open) => !open)}
          onCloseQueue={() => setIsQueueOpen(false)}
        />
      )}
      <LocationProbe />
    </MemoryRouter>
  );
}

function ExclusivePlayerLyricsFixture() {
  const lyricsFullscreenOpen = usePlayerStore((state) => state.lyricsFullscreenOpen);
  const [isQueueOpen, setIsQueueOpen] = React.useState(false);
  return (
    <MemoryRouter>
      {!lyricsFullscreenOpen && (
        <PlayerBar
          onToggleQueue={() => setIsQueueOpen((open) => !open)}
          isQueueOpen={isQueueOpen}
        />
      )}
      {lyricsFullscreenOpen && (
        <FullscreenLyricsPlayer
          isQueueOpen={isQueueOpen}
          onToggleQueue={() => setIsQueueOpen((open) => !open)}
          onCloseQueue={() => setIsQueueOpen(false)}
        />
      )}
    </MemoryRouter>
  );
}

describe('lyrics UI', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    clearFullscreenLyricsCache();
    window.history.replaceState({}, '', '/');
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    usePlayerStore.setState({
      currentTrack: null,
      queue: [],
      originalQueue: [],
      recentlyPlayed: [],
      isPlaying: false,
      progress: 0,
      duration: 0,
      volume: 0.5,
      repeatMode: 'none',
      shuffle: false,
      playbackError: null,
      likedTracks: [],
      isPlayerCollapsed: false,
      lyricsFullscreenOpen: false,
      ...originalPlayerActions,
    });
  });

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    } else {
      delete window.matchMedia;
    }
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
  });

  it('renders counts, preview, and a rights warning without changing lyrics text', async () => {
    const user = userEvent.setup();
    function Fixture() {
      const [value, setValue] = React.useState({
        lyricsText: '',
        lyricsType: 'NONE',
        lyricsLanguage: '',
        lyricsRightsConfirmed: false,
      });
      return <LyricsEditor value={value} onChange={setValue} />;
    }
    render(<Fixture />);
    const textarea = screen.getByPlaceholderText(i18n.t('lyrics.textPlaceholder'));
    await user.type(textarea, 'First line\n\nSecond line');
    expect(screen.getByText(/23 \/ 50,000 characters/)).toBeInTheDocument();
    expect(screen.getByText(i18n.t('lyrics.rightsRequired'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('lyrics.preview') }));
    expect(screen.getByLabelText(i18n.t('lyrics.preview'))).toHaveTextContent('First line Second line');
  });

  it('renders lyrics and a clean no-lyrics state on track pages', async () => {
    getTrackLyrics.mockResolvedValue({
      trackId: track.id,
      hasLyrics: true,
      lyricsType: 'PLAIN',
      lyricsLanguage: 'uk',
      lyricsText: 'Ніч не перекладає мої слова',
    });
    const view = render(<TrackLyricsCard track={track} />);
    expect(await screen.findByText('Ніч не перекладає мої слова')).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage('pl');
    });
    expect(screen.getByText('Ніч не перекладає мої слова')).toBeInTheDocument();
    view.rerender(<TrackLyricsCard track={{ ...track, id: 'empty', hasLyrics: false, lyricsType: 'NONE' }} />);
    expect(screen.getByText(i18n.t('lyrics.noLyrics'))).toBeInTheDocument();
  });

  it('opens and closes fullscreen lyrics lazily without changing playback state', async () => {
    getTrackLyrics.mockResolvedValue({
      trackId: track.id,
      hasLyrics: true,
      lyricsType: 'PLAIN',
      lyricsText: 'Player panel line',
    });
    usePlayerStore.setState({
      currentTrack: track,
      isPlaying: true,
      progress: 21,
      duration: 180,
    });
    render(<PlayerLyricsFixture />);
    expect(getTrackLyrics).not.toHaveBeenCalled();
    const lyricsButtons = screen.getAllByRole('button', { name: i18n.t('player.openLyrics') });
    expect(lyricsButtons).toHaveLength(1);
    expect(screen.queryByTestId('mobile-now-playing-sheet')).not.toBeInTheDocument();
    await userEvent.click(lyricsButtons[0]);
    const dialog = screen.getByRole('dialog', {
      name: i18n.t('lyrics.fullscreenLabel', { title: track.title }),
    });
    expect(dialog).toHaveAttribute('data-testid', 'fullscreen-lyrics-player');
    expect(screen.queryByTestId('player-lyrics-body')).toBeNull();
    expect(await within(dialog).findByText('Player panel line')).toBeInTheDocument();
    expect(getTrackLyrics).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState()).toMatchObject({ isPlaying: true, progress: 21 });
    await userEvent.click(within(dialog).getByTestId('fullscreen-lyrics-back'));
    await waitFor(() => expect(screen.queryByTestId('fullscreen-lyrics-player')).toBeNull());
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('opens the track page from fullscreen controls and closes the lyrics surface', async () => {
    getTrackLyrics.mockResolvedValue({
      trackId: track.id,
      hasLyrics: true,
      lyricsType: 'PLAIN',
      lyricsText: 'Navigate without stopping',
    });
    usePlayerStore.setState({
      currentTrack: track,
      isPlaying: true,
      progress: 21,
      duration: 180,
    });
    render(<PlayerLyricsFixture />);

    await userEvent.click(screen.getAllByRole('button', { name: i18n.t('player.openLyrics') })[0]);
    const controls = screen.getByTestId('fullscreen-standard-desktop-playerbar');
    await userEvent.click(within(controls).getByRole('link', { name: track.title }));

    expect(screen.getByTestId('lyrics-player-route')).toHaveTextContent(`/track/${track.id}`);
    await waitFor(() => expect(screen.queryByTestId('fullscreen-lyrics-player')).toBeNull());
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: { id: track.id },
      isPlaying: true,
      progress: 21,
    });
  });

  it('closes mobile fullscreen, its queue, and the underlying expanded player before navigation', async () => {
    useMobileViewport();
    getTrackLyrics.mockResolvedValue({
      trackId: track.id,
      hasLyrics: true,
      lyricsType: 'PLAIN',
      lyricsText: 'Shared mobile route',
    });
    usePlayerStore.setState({
      currentTrack: track,
      isPlaying: true,
      progress: 21,
      duration: 180,
      isPlayerCollapsed: false,
      lyricsFullscreenOpen: true,
    });
    const audioBeforeNavigation = __getAudioElementForTests();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/discover']}>
        <AppLayout>
          <LocationProbe />
        </AppLayout>
      </MemoryRouter>
    );

    const appShell = document.querySelector('.ns-app-background');
    const fullscreen = screen.getByTestId('fullscreen-lyrics-player');
    const mobileControls = screen.getByTestId('fullscreen-standard-mobile-playerbar');
    const trackInfo = within(mobileControls).getByTestId('standard-player-track-info');
    const titleLink = within(trackInfo).getByRole('link', { name: track.title });
    expect(appShell).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    expect(trackInfo).not.toHaveAttribute('tabindex');

    await user.click(within(mobileControls).getByRole('button', { name: 'Open play queue' }));
    expect(screen.getByRole('dialog', { name: 'Play Queue' })).toBeInTheDocument();
    await user.click(titleLink);

    expect(screen.getByTestId('lyrics-player-route')).toHaveTextContent(`/track/${track.id}`);
    await waitFor(() => expect(screen.queryByTestId('fullscreen-lyrics-player')).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: 'Play Queue' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-now-playing-sheet')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    expect(appShell).not.toHaveAttribute('inert');
    expect(appShell).not.toHaveAttribute('aria-hidden');
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.overscrollBehavior).toBe('');
    expect(document.body.contains(fullscreen)).toBe(false);
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: { id: track.id },
      isPlaying: true,
      progress: 21,
      isPlayerCollapsed: true,
      lyricsFullscreenOpen: false,
    });
    expect(__getAudioElementForTests()).toBe(audioBeforeNavigation);
  });

  it('replaces the fullscreen history sentinel so Back and Forward cross routes without a duplicate', async () => {
    getTrackLyrics.mockResolvedValue({
      trackId: track.id,
      hasLyrics: true,
      lyricsType: 'PLAIN',
      lyricsText: 'History-safe words',
    });
    usePlayerStore.setState({
      currentTrack: track,
      isPlaying: true,
      progress: 21,
      duration: 180,
      isPlayerCollapsed: false,
    });
    const audioBeforeNavigation = __getAudioElementForTests();
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/history-seed');

    render(
      <BrowserRouter>
        <AppLayout>
          <HistoryRouteFixture />
        </AppLayout>
      </BrowserRouter>
    );

    await user.click(screen.getByRole('link', { name: 'Open history route A' }));
    expect(screen.getByTestId('lyrics-player-route')).toHaveTextContent('/discover');

    await user.click(screen.getByRole('button', { name: i18n.t('player.openLyrics') }));
    const historyLengthWithSentinel = window.history.length;
    const desktopControls = screen.getByTestId('fullscreen-standard-desktop-playerbar');
    await user.click(within(desktopControls).getByRole('link', { name: track.title }));

    expect(screen.getByTestId('lyrics-player-route')).toHaveTextContent(`/track/${track.id}`);
    expect(window.history.length).toBe(historyLengthWithSentinel);
    await waitFor(() => expect(screen.queryByTestId('fullscreen-lyrics-player')).not.toBeInTheDocument());
    expect(document.querySelector('.ns-app-background')).not.toHaveAttribute('inert');

    act(() => window.history.back());
    await waitFor(() => expect(screen.getByTestId('lyrics-player-route')).toHaveTextContent('/discover'));
    expect(screen.queryByTestId('fullscreen-lyrics-player')).not.toBeInTheDocument();

    act(() => window.history.forward());
    await waitFor(() => expect(screen.getByTestId('lyrics-player-route')).toHaveTextContent(`/track/${track.id}`));
    expect(screen.queryByTestId('fullscreen-lyrics-player')).not.toBeInTheDocument();

    act(() => window.history.back());
    await waitFor(() => expect(screen.getByTestId('lyrics-player-route')).toHaveTextContent('/discover'));
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByTestId('lyrics-player-route')).toHaveTextContent('/history-seed'));
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: { id: track.id },
      isPlaying: true,
      progress: 21,
      lyricsFullscreenOpen: false,
    });
    expect(__getAudioElementForTests()).toBe(audioBeforeNavigation);
  });

  it('shows a friendly error and retries without exposing the raw failure', async () => {
    getTrackLyrics
      .mockRejectedValueOnce(new Error('Internal Server Error: private upstream detail'))
      .mockResolvedValueOnce({
        trackId: track.id,
        hasLyrics: true,
        lyricsType: 'PLAIN',
        lyricsText: 'Lyrics after retry',
      });
    usePlayerStore.setState({ currentTrack: track, isPlaying: true, lyricsFullscreenOpen: false });
    render(<PlayerLyricsFixture />);

    await userEvent.click(screen.getAllByRole('button', { name: i18n.t('player.openLyrics') })[0]);
    const dialog = screen.getByTestId('fullscreen-lyrics-player');
    expect(await within(dialog).findByText(i18n.t('lyrics.unavailable'))).toBeInTheDocument();
    expect(within(dialog).queryByText(/Internal Server Error/)).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: i18n.t('lyrics.retry') }));
    expect(await within(dialog).findByText('Lyrics after retry')).toBeInTheDocument();
    expect(getTrackLyrics).toHaveBeenCalledTimes(2);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('resolves known demo media failures without masking production or unknown errors', () => {
    const sourceFailure = 'Failed to load because no supported source was found.';
    const options = {
      demoMessage: 'Demo audio source is unavailable',
      unavailableMessage: 'Audio unavailable',
    };

    expect(resolvePlaybackErrorMessage(sourceFailure, {
      ...options,
      mockMode: true,
    })).toBe(options.demoMessage);
    expect(resolvePlaybackErrorMessage(sourceFailure, {
      ...options,
      mockMode: false,
    })).toBe(options.unavailableMessage);
    expect(resolvePlaybackErrorMessage('Stream rejected by the release owner', {
      ...options,
      mockMode: true,
    })).toBe('Stream rejected by the release owner');
  });

  it('renders playback failures as a compact accessible inline status', () => {
    render(<PlaybackErrorStatus error="Stream rejected by the release owner" className="mt-1" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Stream rejected by the release owner');
    expect(alert).toHaveAttribute('aria-live', 'polite');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(alert).toHaveClass('min-w-0', 'truncate', 'text-ns-label', 'mt-1');
    expect(alert).not.toHaveClass('border', 'p-3', 'bg-rose-500/10');
  });

  it('mounts one playback alert and no regular player inside fullscreen lyrics', () => {
    getTrackLyrics.mockResolvedValue({
      trackId: track.id,
      hasLyrics: true,
      lyricsType: 'PLAIN',
      lyricsText: 'One alert only',
    });
    usePlayerStore.setState({
      currentTrack: track,
      playbackError: 'Stream rejected by the release owner',
      lyricsFullscreenOpen: true,
    });

    render(<ExclusivePlayerLyricsFixture />);

    const dialog = screen.getByTestId('fullscreen-lyrics-player');
    const alerts = within(dialog).getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('Stream rejected by the release owner');
    expect(screen.queryByTestId('desktop-player')).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('keeps fullscreen lyrics open and reloads when the current track changes', async () => {
    const nextTrack = {
      ...track,
      id: 'lyrics-track-2',
      title: 'Silent Neon',
      hasLyrics: false,
      lyricsType: 'NONE',
    };
    getTrackLyrics.mockImplementation(async (trackId) => (
      trackId === track.id
        ? { trackId, hasLyrics: true, lyricsType: 'PLAIN', lyricsText: 'First track words' }
        : { trackId, hasLyrics: false }
    ));
    usePlayerStore.setState({ currentTrack: track });
    render(<PlayerLyricsFixture />);

    await userEvent.click(screen.getAllByRole('button', { name: i18n.t('player.openLyrics') })[0]);
    expect(await screen.findByText('First track words')).toBeInTheDocument();

    act(() => {
      usePlayerStore.setState({ currentTrack: nextTrack });
    });

    expect(usePlayerStore.getState().lyricsFullscreenOpen).toBe(true);
    expect(await screen.findByText(i18n.t('lyrics.noLyrics'))).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      i18n.t('lyrics.fullscreenLabel', { title: nextTrack.title })
    );
    expect(getTrackLyrics).toHaveBeenLastCalledWith(nextTrack.id);
  });

  it('closes on Escape and browser Back, traps focus, and restores the opener focus', async () => {
    getTrackLyrics.mockResolvedValue({
      trackId: track.id,
      hasLyrics: true,
      lyricsType: 'PLAIN',
      lyricsText: 'Focus-safe words',
    });
    usePlayerStore.setState({ currentTrack: track });
    render(<PlayerLyricsFixture />);

    const opener = screen.getAllByRole('button', { name: i18n.t('player.openLyrics') })[0];
    opener.focus();
    await userEvent.click(opener);
    const dialog = screen.getByTestId('fullscreen-lyrics-player');
    const closeButton = within(dialog).getByTestId('fullscreen-lyrics-back');
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('fullscreen-lyrics-player')).toBeNull());
    expect(opener).toHaveFocus();
    expect(usePlayerStore.getState().lyricsFullscreenOpen).toBe(false);

    await userEvent.click(opener);
    expect(screen.getByTestId('fullscreen-lyrics-player')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    });
    await waitFor(() => expect(screen.queryByTestId('fullscreen-lyrics-player')).toBeNull());
    expect(usePlayerStore.getState().lyricsFullscreenOpen).toBe(false);
  });

  it('renders shared seek, queue navigation, and desktop volume controls', async () => {
    getTrackLyrics.mockResolvedValue({
      trackId: track.id,
      hasLyrics: true,
      lyricsType: 'PLAIN',
      lyricsText: 'Control surface words',
    });
    usePlayerStore.setState({ currentTrack: track, progress: 12, duration: 180 });
    render(<PlayerLyricsFixture />);
    await userEvent.click(screen.getAllByRole('button', { name: i18n.t('player.openLyrics') })[0]);

    const controls = screen.getByTestId('fullscreen-standard-desktop-playerbar');
    expect(within(controls).getByTestId('standard-player-track-info')).toHaveTextContent(track.title);
    expect(within(controls).getByTestId('standard-player-transport')).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: 'Previous track' })).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: 'Next track' })).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: 'Play' })).toHaveClass('w-9', 'h-9');
    expect(
      within(controls).getByTestId('standard-player-actions')
        .querySelector('button[aria-pressed="true"]')
    ).toHaveAttribute('aria-label', i18n.t('player.closeLyrics'));
    fireEvent.change(within(controls).getByRole('slider', { name: 'Track progress' }), {
      target: { value: '45' },
    });
    expect(usePlayerStore.getState().progress).toBe(45);
    expect(within(controls).getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
    expect(controls.querySelector('[class*="from-rose-500"]')).toBeNull();
  });

  it('routes fullscreen play, seek, volume, and queue through existing player mechanics', async () => {
    const togglePlay = vi.fn();
    const seek = vi.fn();
    const setVolume = vi.fn();
    const audioBeforeOpen = __getAudioElementForTests();
    getTrackLyrics.mockResolvedValue({
      trackId: track.id,
      hasLyrics: true,
      lyricsType: 'PLAIN',
      lyricsText: 'Shared control words',
    });
    usePlayerStore.setState({
      currentTrack: track,
      togglePlay,
      seek,
      setVolume,
    });
    render(<PlayerLyricsFixture />);
    await userEvent.click(screen.getAllByRole('button', { name: i18n.t('player.openLyrics') })[0]);

    const desktopBar = screen.getByTestId('fullscreen-standard-desktop-playerbar');
    await userEvent.click(within(desktopBar).getByTestId('standard-player-play-button'));
    fireEvent.change(within(desktopBar).getByRole('slider', { name: 'Track progress' }), {
      target: { value: '36' },
    });
    fireEvent.change(within(desktopBar).getByRole('slider', { name: 'Volume' }), {
      target: { value: '0.25' },
    });

    expect(togglePlay).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(36);
    expect(setVolume).toHaveBeenCalledWith(0.25);
    expect(__getAudioElementForTests()).toBe(audioBeforeOpen);

    await userEvent.click(within(desktopBar).getByRole('button', { name: 'Open play queue' }));
    expect(screen.getByRole('dialog', { name: 'Play Queue' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Play Queue' })).toBeNull());
    expect(screen.getByTestId('fullscreen-lyrics-player')).toBeInTheDocument();
  });

  it('disables lyrics controls for a track without lyrics', () => {
    usePlayerStore.setState({
      currentTrack: { ...track, id: 'no-lyrics', hasLyrics: false, lyricsType: 'NONE' },
    });
    render(<PlayerLyricsFixture />);
    const unavailable = screen.getAllByRole('button', { name: i18n.t('player.lyricsUnavailable') });
    expect(unavailable).toHaveLength(1);
    expect(screen.queryByTestId('mobile-now-playing-sheet')).not.toBeInTheDocument();
    unavailable.forEach((button) => expect(button).toBeDisabled());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(getTrackLyrics).not.toHaveBeenCalled();
  });
});
