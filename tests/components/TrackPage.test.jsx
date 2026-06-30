import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '../../src/i18n';
import { getTrackById, getTracks } from '../../src/api';

vi.mock('../../src/api', () => ({
  getTrackById: vi.fn(),
  getTracks: vi.fn(),
}));
// Isolate TrackPage from the react-query-backed comments tree.
vi.mock('../../src/components/ui/CommentSection', () => ({
  default: () => <div data-testid="comments-stub" />,
}));

import TrackPage from '../../src/pages/TrackPage';

const baseTrack = {
  id: 't1',
  title: 'Midnight Protocol',
  artistId: 'a1',
  artistName: 'Nonexel',
  genre: 'rap',
  plays: 42,
  duration: 118,
  releaseDate: '2026-06-28',
  tags: ['underground'],
  description: 'A late night cut.',
  waveform: [0.2, 0.5, 0.8, 0.4],
  isStreamable: true,
  coverUrl: null,
  audioUrl: 'http://example.test/stream',
  status: 'PUBLISHED',
};

function renderTrack() {
  return render(
    <MemoryRouter initialEntries={['/track/t1']}>
      <Routes>
        <Route path="/track/:id" element={<TrackPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TrackPage refreshed design', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    getTracks.mockResolvedValue([]);
  });

  it('renders without the old 2x2 stats grid', async () => {
    getTrackById.mockResolvedValue(baseTrack);
    renderTrack();
    await screen.findByText('Midnight Protocol');
    expect(screen.queryByLabelText('Track details')).toBeNull();
    expect(screen.queryByText('Plays')).toBeNull();
    expect(screen.queryByText('Released', { exact: true })).toBeNull();
  });

  it('shows a compact metadata row (plays, duration, date), genre pill, and note', async () => {
    getTrackById.mockResolvedValue(baseTrack);
    renderTrack();
    await screen.findByText('Midnight Protocol');
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getAllByText('1:58').length).toBeGreaterThan(0);
    expect(screen.getByText(/Jun 28, 2026/)).toBeInTheDocument();
    expect(screen.getByText('Rap')).toBeInTheDocument();
    expect(screen.getByText('Uploaded by Nonexel')).toBeInTheDocument();
  });

  it('does not crash when metadata is missing and shows compact empty states', async () => {
    getTrackById.mockResolvedValue({
      ...baseTrack,
      duration: null,
      releaseDate: null,
      plays: 0,
      description: '',
      tags: [],
      waveform: [],
    });
    renderTrack();
    await screen.findByText('Midnight Protocol');
    expect(screen.queryByText('1:58')).toBeNull();
    expect(screen.getByText(i18n.t('trackPage.noDescription'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('trackPage.beFirstToListen'))).toBeInTheDocument();
  });

  it('shows a friendly related-tracks empty state', async () => {
    getTrackById.mockResolvedValue(baseTrack);
    getTracks.mockResolvedValue([]);
    renderTrack();
    await screen.findByText('Midnight Protocol');
    expect(screen.getByText(i18n.t('trackPage.noSimilarTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('trackPage.noSimilarDesc'))).toBeInTheDocument();
  });

  it('uses theme CSS variables for hero accents (no hardcoded pink)', async () => {
    getTrackById.mockResolvedValue(baseTrack);
    const { container } = renderTrack();
    await screen.findByText('Midnight Protocol');
    expect(container.innerHTML).toContain('--ns-accent-soft');
    expect(container.innerHTML).toContain('--ns-border');
  });

  it('localizes the genre label', async () => {
    getTrackById.mockResolvedValue(baseTrack);
    await i18n.changeLanguage('uk');
    renderTrack();
    await screen.findByText('Midnight Protocol');
    expect(screen.getByText('Реп')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});
