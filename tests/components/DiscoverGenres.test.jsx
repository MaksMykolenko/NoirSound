import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '../../src/i18n';
import Discover from '../../src/pages/Discover';
import { getGroupOf, normalizeGenre } from '../../src/constants/musicGenres';
import { useCatalogTracks } from '../../src/hooks/queries/useTracks';

vi.mock('../../src/hooks/queries/useTracks', () => ({ useCatalogTracks: vi.fn() }));
const track = (over) => ({ id: 't', title: 'Track', artistId: 'a', artistName: 'Artist', genre: 'electronic', plays: 0, likes: 0, status: 'PUBLISHED', isStreamable: true, coverUrl: null, ...over });
function setup(tracks, entry = '/discover') {
  useCatalogTracks.mockImplementation((options) => {
    const items = tracks.filter((item) => (!options.group || getGroupOf(item.genre) === options.group) && (!options.genre || normalizeGenre(item.genre) === options.genre));
    return { data: { pages: [{ items, total: items.length, facets: { genres: [
      { value: 'house', label: 'House', count: 1 }, { value: 'rock', label: 'Rock', count: 0 },
    ] } }] }, isLoading: false, error: null, hasNextPage: false };
  });
  return render(<MemoryRouter initialEntries={[entry]}><Discover /></MemoryRouter>);
}
const openGenres = () => {
  fireEvent.click(screen.getByRole('button', { name: i18n.t('start.filters'), exact: true }));
  fireEvent.click(screen.getByTestId('catalog-genre-trigger'));
};

describe('progressive catalog filters', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); vi.clearAllMocks(); });

  it('hides filters on first visit and offers only populated genres when opened', () => {
    setup([track({ id: '1', genre: 'house' })]);
    expect(screen.queryByTestId('catalog-genre-trigger')).not.toBeInTheDocument();
    openGenres();
    expect(screen.getByRole('option', { name: /House.*1/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Rock/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Bachata/ })).not.toBeInTheDocument();
  });

  it('selects a populated genre, filters on the server and allows clearing it with filters closed', () => {
    setup([track({ id: '1', title: 'HouseSong', genre: 'house' }), track({ id: '2', title: 'RockSong', genre: 'rock' })]);
    openGenres();
    fireEvent.click(screen.getByRole('option', { name: /House.*1/ }));
    expect(screen.getByText('HouseSong')).toBeInTheDocument();
    expect(screen.queryByText('RockSong')).not.toBeInTheDocument();
    expect(useCatalogTracks).toHaveBeenLastCalledWith(expect.objectContaining({ genre: 'house' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter: House', exact: true }));
    expect(screen.getByText('RockSong')).toBeInTheDocument();
  });

  it('preserves an active empty genre from a shared URL so it can be removed', () => {
    setup([], '/discover?genre=rock');
    fireEvent.click(screen.getByTestId('catalog-genre-trigger'));
    expect(screen.getByRole('option', { name: /Rock.*0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filter: Rock', exact: true })).toBeInTheDocument();
  });

  it('normalizes legacy labels and safely displays custom genres', () => {
    setup([track({ id: '1', genre: 'Dark Synth' }), track({ id: '2', title: 'WeirdTrack', genre: 'Vinyl Crackle' })]);
    expect(screen.getByText('Synthwave')).toBeInTheDocument();
    expect(screen.getByText('Vinyl Crackle')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
  });

  it.each(['uk', 'pl', 'ru'])('keeps genre names in English with %s interface copy', async (lng) => {
    await i18n.changeLanguage(lng);
    setup([track({ id: '1', title: 'HouseSong', genre: 'house' })]);
    openGenres();
    fireEvent.click(screen.getByRole('option', { name: /House.*1/ }));
    expect(screen.getByRole('button', { name: `${i18n.t('discover.clearFilter')}: House` })).toBeInTheDocument();
  });
});
