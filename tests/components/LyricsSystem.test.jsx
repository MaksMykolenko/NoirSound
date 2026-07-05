import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import LyricsEditor from '../../src/components/lyrics/LyricsEditor';
import TrackLyricsCard from '../../src/components/lyrics/TrackLyricsCard';
import PlayerBar from '../../src/components/player/PlayerBar';
import FullscreenLyricsPlayer from '../../src/components/player/FullscreenLyricsPlayer';
import { clearFullscreenLyricsCache } from '../../src/components/player/fullscreenLyricsCache';
import { usePlayerStore } from '../../src/store/playerStore';
import { getTrackLyrics } from '../../src/api/lyrics';

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

function PlayerLyricsFixture() {
  const lyricsFullscreenOpen = usePlayerStore((state) => state.lyricsFullscreenOpen);
  return (
    <>
      <PlayerBar onToggleQueue={vi.fn()} isQueueOpen={false} />
      {lyricsFullscreenOpen && <FullscreenLyricsPlayer />}
    </>
  );
}

describe('lyrics UI', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    clearFullscreenLyricsCache();
    window.history.replaceState({}, '', '/');
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
    });
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
    expect(lyricsButtons.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(lyricsButtons[0]);
    const dialog = screen.getByRole('dialog', {
      name: i18n.t('lyrics.fullscreenLabel', { title: track.title }),
    });
    expect(dialog).toHaveAttribute('data-testid', 'fullscreen-lyrics-player');
    expect(screen.queryByTestId('player-lyrics-body')).toBeNull();
    expect(await within(dialog).findByText('Player panel line')).toBeInTheDocument();
    expect(getTrackLyrics).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState()).toMatchObject({ isPlaying: true, progress: 21 });
    await userEvent.click(within(dialog).getByRole('button', { name: i18n.t('player.closeLyrics') }));
    await waitFor(() => expect(screen.queryByTestId('fullscreen-lyrics-player')).toBeNull());
    expect(usePlayerStore.getState().isPlaying).toBe(true);
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
    const closeButton = within(dialog).getByRole('button', { name: i18n.t('player.closeLyrics') });
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

    const controls = screen.getByTestId('fullscreen-lyrics-controls');
    expect(within(controls).getByRole('button', { name: 'Previous track' })).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: 'Next track' })).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    fireEvent.change(within(controls).getByRole('slider', { name: 'Track progress' }), {
      target: { value: '45' },
    });
    expect(usePlayerStore.getState().progress).toBe(45);
    expect(within(controls).getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
  });

  it('disables lyrics controls for a track without lyrics', () => {
    usePlayerStore.setState({
      currentTrack: { ...track, id: 'no-lyrics', hasLyrics: false, lyricsType: 'NONE' },
    });
    render(<PlayerLyricsFixture />);
    const unavailable = screen.getAllByRole('button', { name: i18n.t('player.lyricsUnavailable') });
    expect(unavailable.length).toBeGreaterThanOrEqual(2);
    unavailable.forEach((button) => expect(button).toBeDisabled());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(getTrackLyrics).not.toHaveBeenCalled();
  });
});
