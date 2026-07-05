import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import LyricsEditor from '../../src/components/lyrics/LyricsEditor';
import TrackLyricsCard from '../../src/components/lyrics/TrackLyricsCard';
import PlayerBar from '../../src/components/player/PlayerBar';
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

describe('lyrics UI', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
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

  it('opens and closes the player lyrics panel without changing playback state', async () => {
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
    render(<PlayerBar onToggleQueue={vi.fn()} isQueueOpen={false} />);
    const lyricsButtons = screen.getAllByRole('button', { name: i18n.t('player.lyrics') });
    expect(lyricsButtons.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(lyricsButtons[0]);
    const dialog = screen.getByRole('dialog', { name: track.title });
    expect(await within(dialog).findByText('Player panel line')).toBeInTheDocument();
    expect(usePlayerStore.getState()).toMatchObject({ isPlaying: true, progress: 21 });
    await userEvent.click(within(dialog).getByRole('button', { name: i18n.t('lyrics.close') }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: track.title })).toBeNull());
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('shows a friendly unavailable state when the lazy lyrics request fails', async () => {
    getTrackLyrics.mockRejectedValue(new Error('Network unavailable'));
    usePlayerStore.setState({ currentTrack: track, isPlaying: true });
    render(<PlayerBar onToggleQueue={vi.fn()} isQueueOpen={false} />);

    await userEvent.click(screen.getAllByRole('button', { name: i18n.t('player.lyrics') })[0]);
    const dialog = screen.getByRole('dialog', { name: track.title });
    expect(await within(dialog).findByText(i18n.t('lyrics.unavailable'))).toBeInTheDocument();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('disables lyrics controls for a track without lyrics', () => {
    usePlayerStore.setState({
      currentTrack: { ...track, id: 'no-lyrics', hasLyrics: false, lyricsType: 'NONE' },
    });
    render(<PlayerBar onToggleQueue={vi.fn()} isQueueOpen={false} />);
    const unavailable = screen.getAllByRole('button', { name: i18n.t('player.lyricsUnavailable') });
    expect(unavailable.length).toBeGreaterThanOrEqual(2);
    unavailable.forEach((button) => expect(button).toBeDisabled());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(getTrackLyrics).not.toHaveBeenCalled();
  });
});
