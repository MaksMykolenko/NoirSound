import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/i18n';
import App from '../../src/App';
import { useUserStore } from '../../src/store/userStore';

vi.mock('../../src/pages/LandingPage', () => ({ default: () => <div data-testid="landing-page">Landing</div> }));
vi.mock('../../src/pages/Home', () => ({ default: () => <div data-testid="home-page">Home</div> }));
vi.mock('../../src/pages/Discover', () => ({ default: () => <div data-testid="discover-page">Discover</div> }));
vi.mock('../../src/pages/UploadForm', () => ({ default: () => <div data-testid="upload-page">Upload</div> }));
vi.mock('../../src/pages/TrackPage', () => ({ default: () => <div data-testid="track-page">Track</div> }));

const originalPublicAppEnabled = import.meta.env.VITE_PUBLIC_APP_ENABLED;

function renderAt(path) {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

describe('PublicAppGate and Landing-Only Access Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({ authHydrated: true, user: null, fetchCurrentUser: vi.fn().mockResolvedValue(null) });
  });

  afterEach(() => {
    cleanup();
    import.meta.env.VITE_PUBLIC_APP_ENABLED = originalPublicAppEnabled;
  });

  it('redirects unauthenticated users from /discover to /?notice=coming-soon when app is gated', async () => {
    import.meta.env.VITE_PUBLIC_APP_ENABLED = 'false';
    useUserStore.setState({ user: null, authHydrated: true });

    renderAt('/discover');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
      expect(window.location.search).toBe('?notice=coming-soon');
    });
  });

  it('redirects listener users from /upload to /?notice=coming-soon when app is gated', async () => {
    import.meta.env.VITE_PUBLIC_APP_ENABLED = 'false';
    useUserStore.setState({
      user: { id: 'listener-1', username: 'listener_bob', role: 'LISTENER', canUploadTracks: false },
      authHydrated: true,
    });

    renderAt('/upload');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
      expect(window.location.search).toBe('?notice=coming-soon');
    });
  });

  it('allows admin users to bypass the gate and access /discover', async () => {
    import.meta.env.VITE_PUBLIC_APP_ENABLED = 'false';
    useUserStore.setState({
      user: { id: 'admin-1', username: 'admin_alex', role: 'ADMIN', canUploadTracks: true },
      authHydrated: true,
    });

    renderAt('/discover');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/discover');
    });
  });
});

