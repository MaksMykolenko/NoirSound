import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import { getArtistDashboard } from '../../src/api';
import { useUserStore } from '../../src/store/userStore';
import { formatNumber } from '../../src/utils/formatLocale';

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
  geography: null,
  trends: null,
};

const beatTrack = {
  id: 'beat-1',
  title: 'Concrete Pulse',
  genre: 'hip-hop',
  contentType: 'BEAT',
  beatBpm: 138,
  beatKey: 'F# minor',
  status: 'PUBLISHED',
  plays: 18,
  coverUrl: null,
  hasLyrics: false,
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

    expect(await screen.findByText(i18n.t('dashboard.publishedReleases', { count: 1 }))).toBeInTheDocument();
    const actions = getDashboardUploadActions();
    expect(actions).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Midnight Signals' })).toHaveLength(3);
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
  });

  it('renders backend-provided Music and Beats catalogue metrics and separate top lists', async () => {
    getArtistDashboard.mockResolvedValue({
      ...populatedDashboard,
      tracks: [populatedTrack, beatTrack],
      recentUploads: [beatTrack, populatedTrack],
      musicTrackCount: 8,
      beatTrackCount: 3,
      musicPlays: 1240,
      beatPlays: 318,
      topMusicTracks: [populatedTrack],
      topBeats: [beatTrack],
    });

    renderDashboard();

    const breakdown = await screen.findByTestId('dashboard-content-breakdown');
    expect(within(breakdown).getByText(i18n.t('dashboard.musicReleases', { defaultValue: 'Music releases' }))).toBeInTheDocument();
    expect(within(breakdown).getByText('8')).toBeInTheDocument();
    expect(within(breakdown).getByText('3')).toBeInTheDocument();
    expect(within(breakdown).getByText(formatNumber(1240))).toBeInTheDocument();
    expect(within(breakdown).getByText('318')).toBeInTheDocument();

    expect(screen.getByRole('heading', {
      name: i18n.t('dashboard.topMusic', { defaultValue: 'Top music' }),
    })).toBeInTheDocument();
    expect(screen.getByRole('heading', {
      name: i18n.t('dashboard.topBeats', { defaultValue: 'Top beats' }),
    })).toBeInTheDocument();
    expect(screen.getAllByTestId('beat-badge').length).toBeGreaterThan(0);
    expect(screen.getAllByText(beatTrack.title).length).toBeGreaterThan(0);
  });

  it('uses one responsive DOM action and navigates it to the upload route', async () => {
    getArtistDashboard.mockResolvedValue(populatedDashboard);
    const user = userEvent.setup();

    renderDashboard();

    await screen.findByText(i18n.t('dashboard.publishedReleases', { count: 1 }));
    const [action] = getDashboardUploadActions();
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

  it('localizes dashboard headings, statuses, and actions in Ukrainian', async () => {
    await i18n.changeLanguage('uk');
    getArtistDashboard.mockResolvedValue(populatedDashboard);

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Опубліковані релізи (1)' })).toBeInTheDocument();
    expect(screen.getByText('Опублікований')).toBeInTheDocument();
    expect(screen.queryByText('PUBLISHED')).not.toBeInTheDocument();
    const editLyricsActions = screen.getAllByRole('button', { name: 'Редагувати текст треку Midnight Signals' });
    expect(editLyricsActions).toHaveLength(3);
    editLyricsActions.forEach((action) => expect(action).toHaveAttribute('type', 'button'));
    expect(getDashboardUploadActions()).toHaveLength(1);
    expect(getDashboardUploadActions()[0]).toHaveTextContent('Завантажити новий трек');
  });

  it('reports analytics unavailability without fabricated geography or trend data', async () => {
    getArtistDashboard.mockResolvedValue(populatedDashboard);

    renderDashboard();

    await screen.findByRole('heading', {
      name: i18n.t('dashboard.publishedReleases', { count: 1 }),
    });

    const analyticsRegion = screen.getByRole('region', { name: i18n.t('dashboard.analytics') });
    expect(analyticsRegion).toBe(screen.getByTestId('dashboard-analytics-unavailable'));
    expect(within(analyticsRegion).getByText(i18n.t('dashboard.analyticsUnavailable'))).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: i18n.t('dashboard.geographyTitle') })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: i18n.t('dashboard.trendsTitle') })).not.toBeInTheDocument();
  });

  it('renders a compact localized state when recent uploads are absent', async () => {
    getArtistDashboard.mockResolvedValue({
      ...populatedDashboard,
      recentUploads: [],
    });

    renderDashboard();

    expect(await screen.findByText(i18n.t('dashboard.noRecentUploads'))).toBeInTheDocument();
  });
});
