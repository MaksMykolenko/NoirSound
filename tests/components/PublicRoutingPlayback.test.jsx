import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, useLocation } from 'react-router-dom';
import App from '../../src/App';
import i18n from '../../src/i18n';
import { __getAudioElementForTests, usePlayerStore } from '../../src/store/playerStore';
import { useUserStore } from '../../src/store/userStore';
import { clearFullscreenLyricsCache } from '../../src/components/player/fullscreenLyricsCache';

// Real router, layout, player, modal and stores; page bodies are deliberately
// small so these tests isolate lifecycle and route contracts from catalog IO.
vi.mock('../../src/pages/LandingPage', () => ({ default: () => <RouteBody name="Landing" /> }));
vi.mock('../../src/pages/Home', () => ({ default: () => <RouteBody name="App Home" /> }));
vi.mock('../../src/pages/Discover', () => ({ default: () => <RouteBody name="Discover catalog" /> }));
vi.mock('../../src/pages/TrackPage', () => ({ default: () => <RouteBody name="Track detail" /> }));
vi.mock('../../src/api/lyrics', () => ({
  getTrackLyrics: vi.fn().mockResolvedValue({ hasLyrics: true, lyricsType: 'PLAIN', lyricsText: 'Persistent words' }),
}));

function RouteBody({ name }) {
  const location = useLocation();
  return (
    <section aria-label={name}>
      <h1>{name}</h1>
      <output aria-label="Current route">{location.pathname}{location.search}{location.hash}</output>
      <Link to="/">Go to landing</Link>
      <Link to="/discover?content=BEAT&sort=newest&genre=hip_hop#discover-search">Go to Beats</Link>
      <Link to="/home">Go to app Home</Link>
    </section>
  );
}

const track = {
  id: 'landing-continuity-track', title: 'Persistent recording', artistId: 'artist-1',
  artistName: 'Original Artist', isStreamable: true, hasLyrics: true, lyricsType: 'PLAIN', duration: 180,
};
const secondTrack = { ...track, id: 'second-track', title: 'Next recording' };
const userState = useUserStore.getState();
let mediaPlay;
let mediaPause;
let incrementPlayStats;

function renderAt(path) {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

describe('public layout routing and persistent playback', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_PUBLIC_APP_ENABLED', 'true');
    await i18n.changeLanguage('en');
    localStorage.clear();
    clearFullscreenLyricsCache();
    document.body.style.overflow = '';
    mediaPlay = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    mediaPause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    incrementPlayStats = vi.fn().mockResolvedValue({});
    useUserStore.setState({
      user: null, authHydrated: true, isAuthModalOpen: false,
      fetchCurrentUser: vi.fn().mockResolvedValue(null), incrementPlayStats,
    });
    usePlayerStore.setState({
      currentTrack: null, queue: [], originalQueue: [], queueSource: null,
      isPlaying: false, progress: 0, duration: 0, volume: 0.7, shuffle: false,
      repeatMode: 'none', isPlayerCollapsed: false, lyricsFullscreenOpen: false,
      likedTracks: [], playbackError: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    mediaPlay.mockRestore();
    mediaPause.mockRestore();
    useUserStore.setState(userState);
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
  });

  it.each([null, { id: 'signed-in-listener', role: 'LISTENER', displayName: 'Listener' }])(
    'renders / as a public landing without an empty player or app navigation for %j', async (user) => {
      useUserStore.setState({ user, fetchCurrentUser: vi.fn().mockResolvedValue(user) });
      renderAt('/?campaign=shared#listen');
      expect(await screen.findByRole('heading', { name: 'Landing' })).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Current route' })).toHaveTextContent('/?campaign=shared#listen');
      expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Search NoirSound')).not.toBeInTheDocument();
      expect(screen.queryByTestId('desktop-player')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /(?:open|expand) player/i })).not.toBeInTheDocument();
      fireEvent.scroll(window);
      expect(mediaPlay).not.toHaveBeenCalled();
      expect(incrementPlayStats).not.toHaveBeenCalled();
    }
  );

  it('keeps Discover query and hash parameters, and exposes the previous Home at /home', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('link', { name: 'Go to Beats' }));
    expect(await screen.findByRole('heading', { name: 'Discover catalog' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Current route' }))
      .toHaveTextContent('/discover?content=BEAT&sort=newest&genre=hip_hop#discover-search');
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    const homeNavigation = within(screen.getByRole('navigation', { name: 'Mobile navigation' }))
      .getByRole('link', { name: 'Home' });
    expect(homeNavigation).toHaveAttribute('href', '/home');
    await user.click(homeNavigation);
    expect(await screen.findByRole('heading', { name: 'App Home' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/home');
    expect(incrementPlayStats).not.toHaveBeenCalled();
  });

  it('keeps the same audio and PlayerBar nodes with track, queue, progress and preferences across app → landing → track', async () => {
    const playbackState = {
      currentTrack: track, queue: [track, secondTrack], originalQueue: [secondTrack, track],
      queueSource: { type: 'playlist', id: 'stable-playlist' }, isPlaying: true,
      progress: 23.75, duration: 180, volume: 0.32, shuffle: true, repeatMode: 'all',
    };
    usePlayerStore.setState(playbackState);
    const audio = __getAudioElementForTests();
    audio.currentTime = 23.75;
    audio.volume = 0.32;
    const timeupdateListener = audio.ontimeupdate;
    const user = userEvent.setup();
    renderAt('/discover?content=MUSIC');
    await screen.findByRole('heading', { name: 'Discover catalog' });
    const playerNode = screen.getByTestId('desktop-player');
    const trackLink = within(playerNode).getByRole('link', { name: track.title });

    await user.click(screen.getByRole('link', { name: 'Go to landing' }));
    expect(await screen.findByRole('heading', { name: 'Landing' })).toBeInTheDocument();
    expect(screen.getByTestId('desktop-player')).toBe(playerNode);
    expect(within(playerNode).getByRole('link', { name: track.title })).toBe(trackLink);
    expect(usePlayerStore.getState()).toMatchObject(playbackState);

    await user.click(trackLink);
    expect(await screen.findByRole('heading', { name: 'Track detail' })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/track/${track.id}`);
    expect(screen.getByTestId('desktop-player')).toBe(playerNode);
    expect(usePlayerStore.getState()).toMatchObject(playbackState);
    expect(__getAudioElementForTests()).toBe(audio);
    expect(audio.ontimeupdate).toBe(timeupdateListener);
    expect(audio.currentTime).toBe(23.75);
    expect(audio.volume).toBe(0.32);
    expect(mediaPlay).not.toHaveBeenCalled();
    expect(mediaPause).not.toHaveBeenCalled();
    expect(incrementPlayStats).not.toHaveBeenCalled();
  });

  it('runs shared queue, context actions and fullscreen lyrics on landing with inert, Escape and focus restoration', async () => {
    usePlayerStore.setState({ currentTrack: track, queue: [track, secondTrack], isPlaying: true });
    const user = userEvent.setup();
    renderAt('/');
    const landingHeading = await screen.findByRole('heading', { name: 'Landing' });
    const openQueue = screen.getByRole('button', { name: 'Open play queue' });
    await user.click(openQueue);
    const queue = screen.getByRole('dialog', { name: 'Play Queue' });
    expect(landingHeading.closest('[inert]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(within(queue).getByRole('button', { name: `Actions: ${track.title}` }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(queue).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Play Queue' })).not.toBeInTheDocument();
    expect(openQueue).toHaveFocus();
    expect(landingHeading.closest('[inert]')).toBeNull();

    const lyricsButton = screen.getByRole('button', { name: 'Open fullscreen lyrics' });
    await user.click(lyricsButton);
    expect(await screen.findByText('Persistent words')).toBeInTheDocument();
    expect(landingHeading.closest('[inert]')).not.toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('fullscreen-lyrics-player')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open fullscreen lyrics' })).toHaveFocus());
    expect(landingHeading.closest('[inert]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 20)); });
    expect(window.location.pathname).toBe('/');
    expect(usePlayerStore.getState().currentTrack).toBe(track);
    expect(incrementPlayStats).not.toHaveBeenCalled();
  });
});
