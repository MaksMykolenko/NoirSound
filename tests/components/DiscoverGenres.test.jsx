import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '../../src/i18n';
import Discover from '../../src/pages/Discover';
import { useDiscoverTracks } from '../../src/hooks/queries/useTracks';
import { useArtistsWithTracks } from '../../src/hooks/queries/useArtists';

vi.mock('../../src/hooks/queries/useTracks', () => ({ useDiscoverTracks: vi.fn() }));
vi.mock('../../src/hooks/queries/useArtists', () => ({ useArtistsWithTracks: vi.fn() }));

const track = (over) => ({
  id: 't',
  title: 'Track',
  artistId: 'a',
  artistName: 'Artist',
  genre: 'electronic',
  plays: 0,
  likes: 0,
  status: 'PUBLISHED',
  isStreamable: true,
  coverUrl: null,
  releaseDate: '2026-06-20',
  ...over,
});

function setup(tracks) {
  useDiscoverTracks.mockReturnValue({ data: tracks, isLoading: false, error: null });
  useArtistsWithTracks.mockReturnValue({ data: [], isLoading: false, error: null });
  return render(
    <MemoryRouter>
      <Discover />
    </MemoryRouter>
  );
}

describe('Discover genre filters', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
  });

  it('renders a bounded quick-filter row (not a giant genre row) with a More control', () => {
    setup([track({ id: '1' })]);
    const tabs = screen.getByTestId('genre-quick-tabs');
    // Bounded: a handful of quick groups + All + More, never the full taxonomy.
    expect(within(tabs).getAllByRole('button').length).toBeLessThanOrEqual(9);
    expect(within(tabs).getByText(i18n.t('discover.tabs.more'))).toBeInTheDocument();
  });

  it('opens the full grouped genre picker from More', () => {
    setup([track({ id: '1' })]);
    fireEvent.click(screen.getByText(i18n.t('discover.tabs.more')));
    fireEvent.click(screen.getByTestId('genre-picker-trigger'));
    const panel = screen.getByTestId('genre-picker-panel');
    expect(panel.querySelector('[data-genre-option="bachata"]')).toBeTruthy();
  });

  it('filters tracks by the selected group', () => {
    setup([
      track({ id: '1', title: 'HouseSong', genre: 'house' }),
      track({ id: '2', title: 'RockSong', genre: 'rock' }),
    ]);
    // Quick-tab text is an English genre-group name, never an i18n lookup —
    // see NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md.
    fireEvent.click(screen.getByText('Electronic'));
    expect(screen.getAllByText('HouseSong').length).toBeGreaterThan(0);
    expect(screen.queryByText('RockSong')).not.toBeInTheDocument();
  });

  it('normalizes a legacy genre value safely and labels it in English', () => {
    setup([track({ id: '1', title: 'LegacyTrack', genre: 'Dark Synth' })]);
    // Legacy "Dark Synth" displays as its canonical English label.
    expect(screen.getAllByText('Synthwave').length).toBeGreaterThan(0);
    // ...and is grouped under Electronic.
    fireEvent.click(screen.getByText('Electronic'));
    expect(screen.getAllByText('LegacyTrack').length).toBeGreaterThan(0);
  });

  it('does not crash on an unknown/custom genre', () => {
    setup([track({ id: '1', title: 'WeirdTrack', genre: 'Vinyl Crackle' })]);
    expect(screen.getAllByText('WeirdTrack').length).toBeGreaterThan(0);
    // Unknown genre is shown verbatim, never as an error.
    expect(screen.getAllByText('Vinyl Crackle').length).toBeGreaterThan(0);
  });

  it('never surfaces an internal role as a genre tab', () => {
    setup([track({ id: '1', genre: 'electronic' })]);
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
    expect(screen.queryByText('LISTENER')).not.toBeInTheDocument();
  });

  it.each(['uk', 'pl', 'ru'])('keeps quick tabs, the picker, and the active chip in English under %s UI', async (lng) => {
    await i18n.changeLanguage(lng);
    setup([track({ id: '1', title: 'HouseSong', genre: 'house' })]);

    // Quick tabs stay English.
    const tabs = screen.getByTestId('genre-quick-tabs');
    expect(within(tabs).getByText('Hip-Hop')).toBeInTheDocument();
    expect(within(tabs).getByText('Electronic')).toBeInTheDocument();
    expect(within(tabs).getByText('World')).toBeInTheDocument();

    // The full picker's grouped labels and option labels stay English.
    fireEvent.click(within(tabs).getByText(i18n.t('discover.tabs.more')));
    fireEvent.click(screen.getByTestId('genre-picker-trigger'));
    const panel = screen.getByTestId('genre-picker-panel');
    expect(within(panel).getByText('Hip-Hop & Urban')).toBeInTheDocument();
    const jazzOption = panel.querySelector('[data-genre-option="jazz"]');
    expect(jazzOption).toHaveTextContent('Jazz');

    // Selecting a genre sets an English chip.
    fireEvent.click(panel.querySelector('[data-genre-option="house"]'));
    expect(screen.getAllByText('House').length).toBeGreaterThan(0);

    await i18n.changeLanguage('en');
  });
});
