import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import Discover from '../../src/pages/Discover';
import Header from '../../src/components/layout/Header';
import MobileHeader from '../../src/components/layout/MobileHeader';
import ContextMenuProvider from '../../src/components/context-menu/ContextMenuProvider';
import { getCatalogTracks, getLikedTracks } from '../../src/api/tracks';
import { getArtistsWithTracks } from '../../src/api/artists';
import { useUserStore } from '../../src/store/userStore';
import { usePlayerStore } from '../../src/store/playerStore';

vi.mock('../../src/api/tracks', async (original) => ({ ...(await original()), getCatalogTracks: vi.fn(), getLikedTracks: vi.fn() }));
vi.mock('../../src/api/artists', async (original) => ({ ...(await original()), getArtistsWithTracks: vi.fn() }));

const initialPlayer = usePlayerStore.getState();
const initialUser = useUserStore.getState();
const clients = [];
const track = (id, extra = {}) => ({ id, title: `Release ${id}`, artistId: 'artist', artistName: 'Catalog Artist', contentType: 'MUSIC', genre: 'house', duration: 125, publishedAt: '2026-01-01', isStreamable: true, ...extra });
const first = track('first');
const late = track('late', { title: 'Łódź Нічний F# signal' });
const page = (items, { total = items.length, nextCursor = null, facets = {} } = {}) => ({ items, total, pageInfo: { nextCursor, hasNextPage: nextCursor !== null, pageSize: 30 }, facets: { genres: [], groups: [], styles: [], moods: [], keys: [], ...facets }, meta: { trendingWindowDays: 7 } });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const calls = () => getCatalogTracks.mock.calls.filter(([options]) => options.limit === 30);
function serveCatalog(handler) {
  getCatalogTracks.mockImplementation((options, request) => options.limit === 30 ? handler(options, request) : Promise.resolve(page([])));
}
function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="catalog-location">{location.pathname}{location.search}{location.hash}</output><button onClick={() => navigate(-1)}>History back</button><button onClick={() => navigate(1)}>History forward</button></>;
}
function renderCatalog(entries = ['/discover'], { headers = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}><ContextMenuProvider>
    {headers && <><Header /><MobileHeader onOpenDrawer={vi.fn()} /></>}
    <Navigation />
    <Routes><Route path="/discover" element={<Discover />} /><Route path="/track/:id" element={<Link to={entries.at(-1)}>Return to catalog</Link>} /><Route path="/previous" element={<p>Previous route</p>} /></Routes>
  </ContextMenuProvider></MemoryRouter></QueryClientProvider>);
  return client;
}
const catalog = () => within(screen.getByTestId('all-releases'));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
  getArtistsWithTracks.mockResolvedValue([]);
  getLikedTracks.mockResolvedValue([]);
  useUserStore.setState({ user: null });
  usePlayerStore.setState({ ...initialPlayer, currentTrack: null, queue: [], likedTracks: [], isPlaying: false, playTrack: vi.fn(), toggleLikeTrack: vi.fn() });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  usePlayerStore.setState(initialPlayer, true);
  useUserStore.setState(initialUser, true);
});

describe('catalog server-state correctness', () => {
  it('loads another page once, retains rows after failure, retries the same cursor, and uses late-row actions', async () => {
    const secondRequest = deferred();
    let continuations = 0;
    serveCatalog((options) => {
      if (!options.cursor) return Promise.resolve(page([first], { total: 2, nextCursor: 'second' }));
      continuations += 1;
      return continuations === 1 ? secondRequest.promise : Promise.resolve(page([first, late], { total: 2 }));
    });
    renderCatalog();
    expect(await screen.findByText(first.title)).toBeInTheDocument();
    expect(screen.getByTestId('catalog-results-summary')).toHaveTextContent('Showing 1 of 2');
    const more = screen.getByRole('button', { name: 'Show more' });
    fireEvent.click(more); fireEvent.click(more);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Loading more…' })).toBeDisabled());
    expect(continuations).toBe(1);
    expect(usePlayerStore.getState().playTrack).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().queue).toEqual([]);
    await act(async () => secondRequest.reject(new Error('Temporary continuation failure')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your current results are still available');
    expect(catalog().getByText(first.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(late.title)).toBeInTheDocument();
    expect(catalog().getAllByText(first.title)).toHaveLength(1);
    expect(screen.getByTestId('catalog-results-summary')).toHaveTextContent('Showing 2 of 2');
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(calls().map(([options]) => options.cursor)).toEqual([null, 'second', 'second']);
    const row = screen.getByTestId('all-releases').querySelector('[data-track-id="late"]');
    fireEvent.click(within(row).getByRole('button', { name: `Play ${late.title}` }));
    expect(usePlayerStore.getState().playTrack).toHaveBeenCalledWith(late, [first, late], null);
    fireEvent.click(within(row).getByRole('button', { name: `Like ${late.title}` }));
    expect(usePlayerStore.getState().toggleLikeTrack).toHaveBeenCalledWith(late.id);
    fireEvent.click(within(row).getByRole('button', { name: `More actions for ${late.title}` }));
    expect(await screen.findByRole('menu')).toHaveTextContent('Add to playlist');
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    fireEvent.contextMenu(row);
    expect(await screen.findByRole('menu')).toHaveTextContent('Add to playlist');
  });

  it('trusts server order and full totals/facets rather than sorting or counting the loaded page', async () => {
    const older = track('older', { publishedAt: '2020-01-01' });
    const newer = track('newer', { publishedAt: '2026-09-01' });
    serveCatalog(() => Promise.resolve(page([older, newer], { total: 170, facets: { genres: [{ value: 'house', label: 'House', count: 129 }] } })));
    renderCatalog();
    await screen.findByText(older.title);
    expect([...screen.getByTestId('all-releases').querySelectorAll('[data-track-id]')].map((element) => element.dataset.trackId)).toEqual(['older', 'newer']);
    expect(screen.getByTestId('catalog-results-summary')).toHaveTextContent('Showing 2 of 170');
    expect(within(screen.getByTestId('discover-genre-tiles')).getByRole('button', { name: /House.*129/ })).toBeInTheDocument();
  });

  it('debounces Unicode search with replace history and resets the cursor for filter changes', async () => {
    serveCatalog((options) => Promise.resolve(page([options.q ? late : first], { nextCursor: options.q ? null : 'first-query-next' })));
    renderCatalog(['/previous', '/discover?content=BEAT&style=Trap&key=F%23+Minor']);
    await screen.findByText(first.title);
    const input = screen.getByRole('searchbox', { name: 'Search catalog' });
    fireEvent.change(input, { target: { value: 'Łódź' } });
    fireEvent.change(input, { target: { value: 'Łódź Нічний' } });
    expect(calls()).toHaveLength(1);
    await waitFor(() => expect(calls().at(-1)[0].q).toBe('Łódź Нічний'));
    expect(calls().map(([options]) => options.q)).toEqual(['', 'Łódź Нічний']);
    expect(calls().at(-1)[0]).toMatchObject({ cursor: null, contentType: 'BEAT', style: 'Trap', key: 'F# Minor' });
    fireEvent.click(screen.getByRole('tab', { name: 'Music', exact: true }));
    await waitFor(() => expect(calls().at(-1)[0].contentType).toBe('MUSIC'));
    expect(calls().at(-1)[0]).toMatchObject({ q: 'Łódź Нічний', style: '', key: '', cursor: null });
    fireEvent.click(screen.getByRole('button', { name: 'History back' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Beats', exact: true })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('searchbox', { name: 'Search catalog' })).toHaveValue('Łódź Нічний');
    fireEvent.click(screen.getByRole('button', { name: 'History back' }));
    expect(await screen.findByText('Previous route')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'History forward' }));
    expect(await screen.findByRole('searchbox', { name: 'Search catalog' })).toHaveValue('Łódź Нічний');
  });

  it('cancels a stale response and never appends it to a newer search', async () => {
    const stale = deferred();
    let staleSignal;
    serveCatalog((options, { signal }) => {
      if (options.q === 'old') { staleSignal = signal; return stale.promise; }
      return Promise.resolve(page([late]));
    });
    renderCatalog(['/discover?q=old']);
    await waitFor(() => expect(staleSignal).toBeDefined());
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search catalog' }), { target: { value: 'new' } });
    expect(await screen.findByText(late.title)).toBeInTheDocument();
    expect(staleSignal.aborted).toBe(true);
    await act(async () => stale.resolve(page([first])));
    expect(catalog().queryByText(first.title)).not.toBeInTheDocument();
    expect(screen.getByTestId('catalog-location')).toHaveTextContent('q=new');
  });

  it('isolates cached catalog results when the viewer changes or logs out', async () => {
    const viewerB = deferred();
    serveCatalog(() => {
      const viewer = useUserStore.getState().user?.id;
      if (viewer === 'b') return viewerB.promise;
      return Promise.resolve(page(viewer === 'a' ? [track('a', { isLiked: true })] : []));
    });
    useUserStore.setState({ user: { id: 'a' } });
    const client = renderCatalog();
    expect(await screen.findByText('Release a')).toBeInTheDocument();
    act(() => useUserStore.setState({ user: { id: 'b' } }));
    await waitFor(() => expect(screen.queryByText('Release a')).not.toBeInTheDocument());
    await act(async () => viewerB.resolve(page([track('b', { isLiked: false })])));
    expect(await screen.findByText('Release b')).toBeInTheDocument();
    expect(client.getQueryCache().findAll({ queryKey: ['tracks', 'catalog'] }).map((query) => query.queryKey[2])).toEqual(['a', 'b']);
    act(() => useUserStore.setState({ user: null }));
    await waitFor(() => expect(screen.getByTestId('catalog-results-summary')).toHaveTextContent('Showing 0 of 0'));
    expect(catalog().queryByText('Release b')).not.toBeInTheDocument();
  });

  it('does not turn an initial API error into an empty result or a zero count', async () => {
    serveCatalog(() => Promise.reject(new Error('Catalog query rejected')));
    renderCatalog(['/discover?sort=unsupported']);
    const section = screen.getByTestId('discover-all-content');
    expect(await within(section).findByText('Catalog query rejected')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-results-summary')).not.toBeInTheDocument();
    expect(calls()[0][0].sort).toBe('unsupported');
    expect(within(section).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('submits header search into the same catalog URL and lets mobile Search focus that query', async () => {
    serveCatalog(() => Promise.resolve(page([late])));
    useUserStore.setState({ user: { id: 'viewer' } });
    renderCatalog(['/discover?content=BEAT&style=Trap'], { headers: true });
    const headerInput = screen.getByRole('searchbox', { name: 'Search NoirSound' });
    fireEvent.change(headerInput, { target: { value: '  Łódź Нічний %_#  ' } });
    fireEvent.submit(headerInput.closest('form'));
    await waitFor(() => expect(calls().at(-1)[0].q).toBe('Łódź Нічний %_#'));
    expect(calls().at(-1)[0]).toMatchObject({ contentType: 'BEAT', style: 'Trap' });
    await waitFor(() => expect(screen.getByTestId('discover-all-content')).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search catalog' })).toHaveFocus());
    expect(screen.getByRole('searchbox', { name: 'Search catalog' })).toHaveValue('Łódź Нічний %_#');
  });
  it('does not report a zero for an omitted option in a truncated server facet', async () => {
    serveCatalog(() => Promise.resolve(page([track('beat', { contentType: 'BEAT' })], { facets: {
      styles: [{ value: 'Rare style', label: 'Rare style', count: 400 }],
      meta: { optionLimit: 100, truncated: { styles: true, moods: false, keys: false }, availableOptions: { styles: 101, moods: 0, keys: 0 } },
    } })));
    renderCatalog(['/discover?content=BEAT']);
    await screen.findByText('Release beat');
    fireEvent.click(screen.getByTestId('beat-filter-style-trigger'));
    expect(screen.getByRole('option', { name: 'Trap', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Rare style.*400/ })).toBeInTheDocument();
  });

  it('keeps loaded pages when opening a late track and navigating back', async () => {
    serveCatalog((options) => Promise.resolve(options.cursor ? page([late], { total: 2 }) : page([first], { total: 2, nextCursor: 'second' })));
    renderCatalog(['/discover?q=release&sort=played']);
    await screen.findByText(first.title);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await screen.findByText(late.title);
    const requestsBeforeDetail = calls().length;
    fireEvent.click(catalog().getByRole('link', { name: late.title }));
    expect(await screen.findByRole('link', { name: 'Return to catalog' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'History back' }));
    expect(await screen.findByText(late.title)).toBeInTheDocument();
    expect(screen.getByTestId('catalog-results-summary')).toHaveTextContent('Showing 2 of 2');
    expect(screen.getByRole('searchbox', { name: 'Search catalog' })).toHaveValue('release');
    expect(screen.getByText('All results loaded')).toBeInTheDocument();
    expect(calls()).toHaveLength(requestsBeforeDetail);
  });

  it('normalizes direct contentType links without losing the mode or search in editorial View all links', async () => {
    serveCatalog(() => Promise.resolve(page([first])));
    renderCatalog(['/discover?contentType=MUSIC&q=night&sort=played']);
    await screen.findByText(first.title);
    fireEvent.click(within(screen.getByTestId('discover-new-releases')).getByRole('link', { name: 'View all' }));
    await waitFor(() => expect(calls().at(-1)[0]).toMatchObject({ contentType: 'MUSIC', q: 'night', sort: 'recent', cursor: null }));
    const url = new URL(screen.getByTestId('catalog-location').textContent, 'http://test.local');
    expect(url.searchParams.get('content')).toBe('MUSIC');
    expect(url.searchParams.has('contentType')).toBe(false);
    expect(url.hash).toBe('#discover-catalog');
    await waitFor(() => expect(screen.getByTestId('discover-all-content')).toHaveFocus());
    screen.getByRole('searchbox', { name: 'Search catalog' }).focus();
    fireEvent.click(within(screen.getByTestId('discover-new-releases')).getByRole('link', { name: 'View all' }));
    await waitFor(() => expect(screen.getByTestId('discover-all-content')).toHaveFocus());
  });

  it('focuses a direct catalog anchor after leading results settle without jumping again while typing', async () => {
    const editorial = deferred();
    getCatalogTracks.mockImplementation((options) => options.limit === 30 ? Promise.resolve(page([first])) : editorial.promise);
    renderCatalog(['/discover#discover-catalog']);
    const section = screen.getByTestId('discover-all-content');
    const scrollToCatalog = vi.fn();
    section.scrollIntoView = scrollToCatalog;
    await screen.findByText(first.title);
    expect(section).not.toHaveFocus();
    expect(scrollToCatalog).not.toHaveBeenCalled();
    await act(async () => editorial.resolve(page([])));
    await waitFor(() => expect(section).toHaveFocus());
    expect(scrollToCatalog).toHaveBeenCalledTimes(1);

    const input = screen.getByRole('searchbox', { name: 'Search catalog' });
    input.focus();
    fireEvent.change(input, { target: { value: 'new search' } });
    await waitFor(() => expect(calls().at(-1)[0].q).toBe('new search'));
    expect(input).toHaveFocus();
    expect(scrollToCatalog).toHaveBeenCalledTimes(1);
  });

});
