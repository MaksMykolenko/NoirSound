import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/pages/LandingPage', () => ({
  default: () => <main data-testid="public-landing-page">Public landing</main>,
}));
vi.mock('../../src/pages/admin/AdminOverview', () => ({
  default: () => <div data-testid="admin-overview-page">Admin overview</div>,
}));
vi.mock('../../src/pages/admin/AdminTracks', () => ({
  default: () => <div data-testid="admin-tracks-page">Admin tracks</div>,
}));

const adminUser = {
  id: 'admin-shell-test',
  username: 'admin_shell',
  displayName: 'Admin Shell',
  email: 'admin-shell@test.local',
  role: 'ADMIN',
  status: 'ACTIVE',
};

let App;
let usePlayerStore;
let getAudioElement;
let useUserStore;
let useToastStore;
let audioConstructor;
let mediaPause;
let mediaPlay;

function setUser(user, authHydrated = true) {
  useUserStore.setState({
    user,
    authHydrated,
    authError: null,
    isAuthModalOpen: false,
    fetchCurrentUser: vi.fn().mockResolvedValue(user),
    setAuthModalOpen: vi.fn((isOpen) => useUserStore.setState({ isAuthModalOpen: isOpen })),
  });
}

function renderAt(path) {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

function expectNoPublicChrome() {
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  expect(screen.queryByRole('separator', { name: 'Resize sidebar' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Filter library')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create playlist' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Search NoirSound')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Open library drawer')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('desktop-player')).not.toBeInTheDocument();
  expect(screen.queryByTestId('mobile-collapsed-player')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /(?:open|expand) player/i })).not.toBeInTheDocument();
}

describe.sequential('admin route shell isolation', () => {
  beforeAll(async () => {
    mediaPause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    mediaPlay = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    audioConstructor = vi.fn(function AudioForAdminShellTest() {
      return document.createElement('audio');
    });
    Object.defineProperty(window, 'Audio', { configurable: true, writable: true, value: audioConstructor });
    Object.defineProperty(globalThis, 'Audio', { configurable: true, writable: true, value: audioConstructor });

    ({ default: App } = await import('../../src/App'));
    ({ useUserStore } = await import('../../src/store/userStore'));
    ({ useToastStore } = await import('../../src/store/toastStore'));
  });

  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    useToastStore.setState({ toasts: [] });
    setUser(adminUser);
  });

  afterAll(() => {
    cleanup();
    mediaPause.mockRestore();
    mediaPlay.mockRestore();
  });

  it('loads /admin directly into AdminShell without listener chrome or an Audio engine', async () => {
    renderAt('/admin');

    expect(await screen.findByTestId('admin-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('admin-overview-page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/overview');
    expectNoPublicChrome();
    expect(audioConstructor).not.toHaveBeenCalled();

  });

  it('keeps an unknown /admin path inside the isolated admin route branch', async () => {
    renderAt('/admin/unknown-section');

    expect(await screen.findByTestId('admin-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('admin-overview-page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/overview');
    expectNoPublicChrome();
  });

  it('shows the signed-out guard without mounting either application shell', async () => {
    setUser(null);
    renderAt('/admin/overview');

    expect(await screen.findByRole('heading', { name: /sign in required/i })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-overview-page')).not.toBeInTheDocument();
    expectNoPublicChrome();
  });

  it('shows the forbidden guard to a non-admin without protected content', async () => {
    setUser({ ...adminUser, role: 'LISTENER' });
    renderAt('/admin/overview');

    expect(await screen.findByTestId('admin-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-overview-page')).not.toBeInTheDocument();
    expectNoPublicChrome();
  });

  it('marks the direct admin route active and persists sidebar collapse across remounts', async () => {
    const user = userEvent.setup();
    const first = renderAt('/admin/tracks');

    expect(await screen.findByTestId('admin-tracks-page')).toBeInTheDocument();
    const tracksLink = screen.getByRole('link', { name: 'Tracks' });
    expect(tracksLink).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(window.localStorage.getItem('noirsound_admin_sidebar_collapsed')).toBe('true');

    first.unmount();
    renderAt('/admin/tracks');
    expect(await screen.findByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tracks' })).toHaveAttribute('aria-current', 'page');
  });

  it('pauses an existing listener engine on admin entry, preserves its queue, and never autoplays on return', async () => {
    ({ usePlayerStore, __getAudioElementForTests: getAudioElement } = await import('../../src/store/playerStore'));
    const queue = [
      { id: 'track-1', title: 'First', artist: 'Artist', isStreamable: true },
      { id: 'track-2', title: 'Second', artist: 'Artist', isStreamable: true },
    ];
    usePlayerStore.setState({
      currentTrack: queue[0],
      queue,
      originalQueue: [...queue],
      queueSource: { type: 'playlist', id: 'playlist-1' },
      isPlaying: true,
      isPlayerCollapsed: false,
    });
    const audio = getAudioElement();
    mediaPause.mockClear();
    mediaPlay.mockClear();

    renderAt('/admin/overview');
    expect(await screen.findByTestId('admin-shell')).toBeInTheDocument();
    await waitFor(() => expect(mediaPause).toHaveBeenCalledWith());
    expect(usePlayerStore.getState().queue).toEqual(queue);
    expect(usePlayerStore.getState().originalQueue).toEqual(queue);
    expect(usePlayerStore.getState().currentTrack).toEqual(queue[0]);
    expect(getAudioElement()).toBe(audio);

    await userEvent.click(screen.getByRole('link', { name: 'Back to NoirSound' }));
    expect(await screen.findByTestId('public-landing-page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    expect(mediaPlay).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().queue).toEqual(queue);
  });
});
