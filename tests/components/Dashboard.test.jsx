import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
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
    getArtistDashboard.mockResolvedValue({
      tracks: [],
      totalPlays: 0,
      totalLikes: 0,
      followers: 0,
      monthlyListeners: 0,
      topTracks: [],
      recentUploads: [],
      failedUploads: [],
    });

    const { container } = renderDashboard();

    expect(await screen.findByRole('heading', { name: i18n.t('dashboard.emptyState') })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: i18n.t('dashboard.uploadNew') })).toHaveLength(1);
    expect(screen.getByText(i18n.t('dashboard.emptyDescription'))).toBeInTheDocument();
    expect(container.querySelector('.ns-state-panel')).not.toBeInTheDocument();
  });
});
