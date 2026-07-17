import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppLayout from '../../src/components/layout/AppLayout';
import PlayerBar from '../../src/components/player/PlayerBar';
import { __getAudioElementForTests, usePlayerStore } from '../../src/store/playerStore';
import { isUnmodifiedPrimaryActivation } from '../../src/utils/linkActivation';

const track = {
  id: 'player-track',
  title: 'Midnight Signals',
  artistId: 'artist-1',
  artistName: 'Noir Artist',
  genre: 'electronic',
  coverUrl: null,
  duration: 180,
  isStreamable: true,
  hasLyrics: false,
  lyricsType: 'NONE',
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="player-route">{location.pathname}</output>;
}

const originalMatchMedia = window.matchMedia;

function mockMobileViewport() {
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

function renderPlayerApp(initialRoute = '/discover') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppLayout>
        <LocationProbe />
      </AppLayout>
    </MemoryRouter>
  );
}

function renderExpandedMobilePlayer(initialRoute = '/discover') {
  mockMobileViewport();
  renderPlayerApp(initialRoute);
  const sheet = screen.getByTestId('mobile-now-playing-sheet');
  const titleLink = within(sheet).getByRole('link', { name: track.title });
  return { sheet, titleLink };
}

function clickWithoutFollowingNativeNavigation(element, init = {}) {
  let defaultPreventedByApp;
  const stopNativeNavigationAfterReact = (event) => {
    defaultPreventedByApp = event.defaultPrevented;
    event.preventDefault();
  };

  window.addEventListener('click', stopNativeNavigationAfterReact, { once: true });
  fireEvent.click(element, init);
  return defaultPreventedByApp;
}

describe('player track navigation', () => {
  beforeEach(() => {
    localStorage.removeItem('noirsound.playerCollapsed');
    document.body.style.overflow = '';
    usePlayerStore.setState({
      currentTrack: track,
      queue: [track],
      originalQueue: [track],
      isPlaying: true,
      progress: 27,
      duration: 180,
      playbackError: null,
      likedTracks: [],
      isPlayerCollapsed: false,
      lyricsFullscreenOpen: false,
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
  });

  it('opens the current track page from the title without interrupting playback', async () => {
    const user = userEvent.setup();
    const audioBeforeNavigation = __getAudioElementForTests();

    render(
      <MemoryRouter initialEntries={['/discover']}>
        <PlayerBar onToggleQueue={() => {}} isQueueOpen={false} />
        <LocationProbe />
      </MemoryRouter>
    );

    const desktopTrackInfo = screen.getByTestId('standard-player-track-info');
    const titleLink = within(desktopTrackInfo).getByRole('link', { name: track.title });
    expect(titleLink).toHaveAttribute('href', `/track/${track.id}`);

    await user.click(titleLink);

    expect(screen.getByTestId('player-route')).toHaveTextContent(`/track/${track.id}`);
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: { id: track.id },
      isPlaying: true,
      progress: 27,
    });
    expect(__getAudioElementForTests()).toBe(audioBeforeNavigation);
  });

  it('keeps the title as the only focus target inside shared track info', () => {
    render(
      <MemoryRouter>
        <PlayerBar onToggleQueue={() => {}} isQueueOpen={false} />
      </MemoryRouter>
    );

    const trackInfo = screen.getByTestId('standard-player-track-info');
    const titleLink = within(trackInfo).getByRole('link', { name: track.title });
    expect(trackInfo).not.toHaveAttribute('tabindex');
    expect(titleLink).toHaveAccessibleName(track.title);
    expect(screen.getByRole('button', { name: 'Collapse player' })).toBeInTheDocument();
  });

  it('navigates from the collapsed mobile title by mouse without expanding or resetting playback', async () => {
    mockMobileViewport();
    usePlayerStore.setState({ isPlayerCollapsed: true });
    const audioBeforeNavigation = __getAudioElementForTests();
    const user = userEvent.setup();
    renderPlayerApp();

    const collapsedPlayer = screen.getByTestId('mobile-collapsed-player');
    await user.click(within(collapsedPlayer).getByRole('link', { name: track.title }));

    expect(screen.getByTestId('player-route')).toHaveTextContent(`/track/${track.id}`);
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: { id: track.id },
      isPlaying: true,
      progress: 27,
      isPlayerCollapsed: true,
    });
    expect(screen.queryByTestId('mobile-now-playing-sheet')).not.toBeInTheDocument();
    expect(__getAudioElementForTests()).toBe(audioBeforeNavigation);
  });

  it('lets Enter activate the collapsed mobile title without bubbling into player expansion', async () => {
    mockMobileViewport();
    usePlayerStore.setState({ isPlayerCollapsed: true });
    const user = userEvent.setup();
    renderPlayerApp();

    const collapsedPlayer = screen.getByTestId('mobile-collapsed-player');
    const titleLink = within(collapsedPlayer).getByRole('link', { name: track.title });
    titleLink.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('player-route')).toHaveTextContent(`/track/${track.id}`);
    expect(usePlayerStore.getState().isPlayerCollapsed).toBe(true);
    expect(screen.queryByTestId('mobile-now-playing-sheet')).not.toBeInTheDocument();
  });

  it('does not treat Space on the collapsed mobile title as parent player activation', async () => {
    mockMobileViewport();
    usePlayerStore.setState({ isPlayerCollapsed: true });
    const user = userEvent.setup();
    renderPlayerApp();

    const collapsedPlayer = screen.getByTestId('mobile-collapsed-player');
    const titleLink = within(collapsedPlayer).getByRole('link', { name: track.title });
    titleLink.focus();
    await user.keyboard(' ');

    expect(screen.getByTestId('player-route')).toHaveTextContent('/discover');
    expect(usePlayerStore.getState().isPlayerCollapsed).toBe(true);
    expect(screen.queryByTestId('mobile-now-playing-sheet')).not.toBeInTheDocument();
  });

  it('still expands from the collapsed mobile free area and the named Expand button', async () => {
    mockMobileViewport();
    usePlayerStore.setState({ isPlayerCollapsed: true });
    const user = userEvent.setup();
    renderPlayerApp();

    await user.click(screen.getByTestId('mobile-collapsed-player'));
    const firstSheet = await screen.findByTestId('mobile-now-playing-sheet');
    expect(firstSheet).toHaveAttribute('aria-modal', 'true');

    await user.click(within(firstSheet).getByRole('button', { name: 'Collapse player' }));
    await waitFor(() => expect(screen.queryByTestId('mobile-now-playing-sheet')).not.toBeInTheDocument());

    const collapsedPlayer = screen.getByTestId('mobile-collapsed-player');
    await user.click(within(collapsedPlayer).getByRole('button', { name: 'Expand player' }));
    expect(await screen.findByTestId('mobile-now-playing-sheet')).toHaveAttribute('aria-modal', 'true');
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: { id: track.id },
      isPlaying: true,
      progress: 27,
    });
  });

  it('closes the expanded mobile sheet before title navigation and clears modal state', async () => {
    mockMobileViewport();
    const audioBeforeNavigation = __getAudioElementForTests();
    const initialBodyOverflow = document.body.style.overflow;
    const user = userEvent.setup();
    renderPlayerApp();

    const appShell = document.querySelector('.ns-app-background');
    const sheet = screen.getByTestId('mobile-now-playing-sheet');
    expect(appShell).toHaveAttribute('inert');
    expect(sheet).toHaveAttribute('aria-modal', 'true');

    await user.click(within(sheet).getByRole('link', { name: track.title }));

    expect(screen.getByTestId('player-route')).toHaveTextContent(`/track/${track.id}`);
    await waitFor(() => expect(screen.queryByTestId('mobile-now-playing-sheet')).not.toBeInTheDocument());
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    expect(appShell).not.toHaveAttribute('inert');
    expect(appShell).not.toHaveAttribute('aria-hidden');
    expect(document.body.style.overflow).toBe(initialBodyOverflow);
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: { id: track.id },
      queue: [{ id: track.id }],
      originalQueue: [{ id: track.id }],
      isPlaying: true,
      progress: 27,
      isPlayerCollapsed: true,
    });
    expect(__getAudioElementForTests()).toBe(audioBeforeNavigation);
  });

  it('lets Enter activate the expanded mobile title and closes the sheet', async () => {
    const user = userEvent.setup();
    const { sheet, titleLink } = renderExpandedMobilePlayer();

    await waitFor(() => expect(within(sheet).getByRole('button', { name: 'Collapse player' })).toHaveFocus());
    titleLink.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('player-route')).toHaveTextContent(`/track/${track.id}`);
    await waitFor(() => expect(screen.queryByTestId('mobile-now-playing-sheet')).not.toBeInTheDocument());
    expect(usePlayerStore.getState().isPlayerCollapsed).toBe(true);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
  ])('preserves the expanded mobile player for %s-click', (_modifier, init) => {
    const { titleLink } = renderExpandedMobilePlayer();
    const audioBeforeActivation = __getAudioElementForTests();

    const defaultPreventedByApp = clickWithoutFollowingNativeNavigation(titleLink, init);

    expect(defaultPreventedByApp).toBe(false);
    expect(screen.getByTestId('player-route')).toHaveTextContent('/discover');
    expect(screen.getByTestId('mobile-now-playing-sheet')).toBeInTheDocument();
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: { id: track.id },
      isPlaying: true,
      progress: 27,
      isPlayerCollapsed: false,
    });
    expect(__getAudioElementForTests()).toBe(audioBeforeActivation);
  });

  it('preserves the expanded mobile player for middle-click', () => {
    const { titleLink } = renderExpandedMobilePlayer();
    const audioBeforeActivation = __getAudioElementForTests();

    const defaultPreventedByApp = clickWithoutFollowingNativeNavigation(titleLink, { button: 1 });

    expect(defaultPreventedByApp).toBe(false);
    expect(screen.getByTestId('player-route')).toHaveTextContent('/discover');
    expect(screen.getByTestId('mobile-now-playing-sheet')).toBeInTheDocument();
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: { id: track.id },
      isPlaying: true,
      progress: 27,
      isPlayerCollapsed: false,
    });
    expect(__getAudioElementForTests()).toBe(audioBeforeActivation);
  });

  it.each([
    ['a new-tab target', { target: '_blank' }],
    ['a download link', { download: 'track' }],
  ])('rejects current-tab teardown for %s', (_case, attributes) => {
    const link = document.createElement('a');
    Object.entries(attributes).forEach(([name, value]) => link.setAttribute(name, value));

    expect(isUnmodifiedPrimaryActivation({
      currentTarget: link,
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    })).toBe(false);
  });

  it('does not collapse the expanded mobile player for an already prevented click', () => {
    const { titleLink } = renderExpandedMobilePlayer();
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    event.preventDefault();

    titleLink.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId('player-route')).toHaveTextContent('/discover');
    expect(screen.getByTestId('mobile-now-playing-sheet')).toBeInTheDocument();
    expect(usePlayerStore.getState().isPlayerCollapsed).toBe(false);
  });
});
