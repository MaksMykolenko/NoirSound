import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import { getArtistDashboard } from '../../src/api';
import { useUserStore } from '../../src/store/userStore';

vi.mock('../../src/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getArtistDashboard: vi.fn(),
  };
});

import Dashboard from '../../src/pages/Dashboard';

const populatedTrack = {
  id: 'track-1',
  title: 'Midnight Signals',
  genre: 'electronic',
  status: 'PUBLISHED',
  plays: 42,
  coverUrl: null,
  hasLyrics: false,
};

const emptyDashboard = {
  tracks: [],
  totalPlays: 0,
  totalLikes: 0,
  followers: 0,
  monthlyListeners: 0,
  topTracks: [],
  recentUploads: [],
  failedUploads: [],
};

const populatedDashboard = {
  tracks: [populatedTrack],
  totalPlays: 42,
  totalLikes: 7,
  followers: 3,
  monthlyListeners: 11,
  topTracks: [populatedTrack],
  recentUploads: [populatedTrack],
  failedUploads: [],
};

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<main><Dashboard /></main>} />
        <Route path="/upload" element={<main><h1>Upload destination</h1></main>} />
      </Routes>
    </MemoryRouter>
  );
}

function getDashboardUploadActions() {
  const main = screen.getByRole('main');
  return within(main).getAllByRole('button', { name: i18n.t('dashboard.uploadNew') });
}

describe('Dashboard polish', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    useUserStore.setState({
      user: { id: 'artist-1', role: 'ARTIST', canUploadTracks: true },
      authHydrated: true,
      setAuthModalOpen: vi.fn(),
    });
  });

  it('keeps one primary upload CTA and an unboxed informational empty state', async () => {
    getArtistDashboard.mockResolvedValue(emptyDashboard);

    const { container } = renderDashboard();

    expect(await screen.findByRole('heading', { name: i18n.t('dashboard.emptyState') })).toBeInTheDocument();
    expect(getDashboardUploadActions()).toHaveLength(1);
    expect(screen.getByText(i18n.t('dashboard.emptyDescription'))).toBeInTheDocument();
    expect(container.querySelector('.ns-state-panel')).not.toBeInTheDocument();
  });

  it('keeps exactly one primary upload CTA in the populated dashboard and preserves its data', async () => {
    getArtistDashboard.mockResolvedValue(populatedDashboard);

    renderDashboard();

    expect(await screen.findByText('Published Releases (1)')).toBeInTheDocument();
    const actions = getDashboardUploadActions();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveClass('ns-button-primary');
    expect(screen.getAllByRole('heading', { name: 'Midnight Signals' })).toHaveLength(3);
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
  });

  it('uses one responsive DOM action and navigates it to the upload route', async () => {
    getArtistDashboard.mockResolvedValue(populatedDashboard);
    const user = userEvent.setup();

    renderDashboard();

    await screen.findByText('Published Releases (1)');
    const [action] = getDashboardUploadActions();
    expect(action).not.toHaveClass('hidden');
    await user.click(action);

    expect(await screen.findByRole('heading', { name: 'Upload destination' })).toBeInTheDocument();
  });

  it('keeps the header upload action available while dashboard data is loading or errors', async () => {
    let rejectDashboard;
    getArtistDashboard.mockImplementation(() => new Promise((resolve, reject) => {
      rejectDashboard = reject;
    }));

    renderDashboard();

    await waitFor(() => expect(getArtistDashboard).toHaveBeenCalledTimes(1));
    expect(getDashboardUploadActions()).toHaveLength(1);

    rejectDashboard(new Error('Dashboard unavailable'));
    expect(await screen.findByText('Dashboard unavailable')).toBeInTheDocument();
    expect(getDashboardUploadActions()).toHaveLength(1);
  });

  it('keeps one localized upload action in Ukrainian', async () => {
    await i18n.changeLanguage('uk');
    getArtistDashboard.mockResolvedValue(populatedDashboard);

    renderDashboard();

    await screen.findByText('Published Releases (1)');
    expect(getDashboardUploadActions()).toHaveLength(1);
    expect(getDashboardUploadActions()[0]).toHaveTextContent('Завантажити новий трек');
  });
});
