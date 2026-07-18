import React from 'react';
import { render, screen, within } from '@testing-library/react';
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

  it('uses the full main column and omits the related rail when no related tracks exist', async () => {
    getTrackById.mockResolvedValue(baseTrack);
    getTracks.mockResolvedValue([]);
    renderTrack();
    await screen.findByText('Midnight Protocol');
    expect(screen.queryByTestId('track-related-rail')).not.toBeInTheDocument();
    expect(screen.getByTestId('track-main-column')).toHaveClass('xl:col-span-12');
    expect(within(screen.getByTestId('track-main-column')).getByTestId('track-lyrics-card')).toBeInTheDocument();
  });

  it('renders related tracks in a four-column rail as native links', async () => {
    getTrackById.mockResolvedValue(baseTrack);
    getTracks.mockResolvedValue([
      {
        ...baseTrack,
        id: 't2',
        title: 'Afterglow Signal',
        artistId: 'a2',
        artistName: 'Static Bloom',
      },
    ]);
    renderTrack();

    await screen.findByText('Midnight Protocol');
    const rail = screen.getByTestId('track-related-rail');
    expect(rail).toHaveClass('xl:col-span-4');
    expect(screen.getByTestId('track-main-column')).toHaveClass('xl:col-span-8');
    expect(within(rail).getByRole('link', { name: /Afterglow Signal/ })).toHaveAttribute('href', '/track/t2');
  });

  it('uses theme CSS variables for hero accents (no hardcoded pink)', async () => {
    getTrackById.mockResolvedValue(baseTrack);
    const { container } = renderTrack();
    await screen.findByText('Midnight Protocol');
    expect(container.innerHTML).toContain('--ns-accent-soft');
    expect(container.innerHTML).toContain('--ns-border');
  });

  it('keeps the genre pill in English regardless of UI language', async () => {
    getTrackById.mockResolvedValue(baseTrack);
    for (const lng of ['uk', 'pl', 'ru']) {
      // eslint-disable-next-line no-await-in-loop
      await i18n.changeLanguage(lng);
      const { unmount } = renderTrack();
      // eslint-disable-next-line no-await-in-loop
      await screen.findByText('Midnight Protocol');
      // Genre names are music taxonomy, not UI copy — "Rap" must never
      // become "Реп" no matter which UI language is active.
      expect(screen.getByText('Rap')).toBeInTheDocument();
      expect(screen.queryByText('Реп')).not.toBeInTheDocument();
      unmount();
    }
    await i18n.changeLanguage('en');
  });
});
