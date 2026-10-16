import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, X } from 'lucide-react';
import { useCatalogTracks } from '../hooks/queries/useTracks';
import useDiscoverUrlState from '../hooks/useDiscoverUrlState';
import DiscoverFilterDropdown from '../components/discover/DiscoverFilterDropdown';
import DiscoverRankedList from '../components/discover/DiscoverRankedList';
import DiscoverSection from '../components/discover/DiscoverSection';
import DiscoverVibeBar from '../components/discover/DiscoverVibeBar';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import PageMeta from '../components/meta/PageMeta';
import { QUICK_GROUP_LABELS } from '../constants/musicGenres';
import { getGenreLabel } from '../utils/genreLabels';

const CONTENT_TABS = ['ALL', 'MUSIC', 'BEAT'];
function SectionEmpty({ title, description, onReset, resetLabel }) {
  return <EmptyState iconName="AudioLines" title={title} description={description} actionText={onReset ? resetLabel : undefined} onAction={onReset} />;
}
// Facets describe the full server result, not just the loaded page. Keep an
// active zero-result option visible so shared links can always be cleared.
function populatedOptions(items = [], current, anyLabel, labelFor = (value) => value) {
  const options = items.filter((item) => item.count > 0 || item.value === current)
    .map((item) => ({ value: item.value, label: item.label || labelFor(item.value), hint: item.count }));
  if (current && !options.some((option) => option.value === current)) options.push({ value: current, label: labelFor(current) });
  return [{ value: '', label: anyLabel }, ...options];
}

export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const searchRef = useRef(null);
  const catalogRef = useRef(null);
  const catalogNavigation = useRef({ key: null, pending: false });
  const contentTabRefs = useRef([]);
  const { contentType, q, genre, group, style, mood, bpm, bpmMin, bpmMax, key, sort, hasFilters,
    setContentType, setQuery, setSort, setGenre, setGroup, setBeatFilter, clearFilters } = useDiscoverUrlState();
  const [filtersOpen, setFiltersOpen] = useState(hasFilters || new URLSearchParams(location.search).has('browse'));
  const [searchDraft, setSearchDraft] = useState(q);
  useEffect(() => { setSearchDraft(q); }, [q, location.key]);
  useEffect(() => {
    if (searchDraft.trim() === q) return undefined;
    const timeout = window.setTimeout(() => setQuery(searchDraft, { replace: true }), 300);
    return () => window.clearTimeout(timeout);
  }, [q, searchDraft, setQuery, location.key]);
  useEffect(() => {
    if (location.hash === '#discover-search') searchRef.current?.focus();
  }, [location.hash, location.key]);

  const { data: catalogueData, isLoading: catalogueLoading, error: catalogueError, refetch: refetchCatalogue,
    fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useCatalogTracks({
      ...(contentType === 'ALL' ? {} : { contentType }), q, genre, group, style, mood, bpm, bpmMin, bpmMax, key, sort, limit: 30,
    });
  useEffect(() => {
    if (catalogNavigation.current.key !== location.key) {
      const firstVisit = catalogNavigation.current.key === null;
      catalogNavigation.current = {
        key: location.key,
        pending: location.hash === '#discover-catalog' && (firstVisit || navigationType !== 'REPLACE' || location.state?.focusDiscoverCatalog === true),
      };
    }
    if (!catalogNavigation.current.pending || catalogueLoading) return undefined;
    // Wait until leading sections settle and the route's ordinary scroll
    // effects complete. Typing replaces URL state without requesting a jump.
    const frame = window.requestAnimationFrame(() => {
      if (!catalogRef.current) return;
      catalogNavigation.current.pending = false;
      catalogRef.current.focus({ preventScroll: true });
      catalogRef.current.scrollIntoView?.({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [catalogueLoading, location.hash, location.key, location.state?.focusDiscoverCatalog, navigationType]);

  const catalogue = useMemo(() => {
    const seen = new Set();
    return (catalogueData?.pages || []).flatMap((page) => page.items).filter((track) => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });
  }, [catalogueData]);

  const filteredCatalogue = catalogue;
  const firstPage = catalogueData?.pages[0];
  const total = firstPage?.total;
  const facets = firstPage?.facets;
  const header = contentType === 'MUSIC'
    ? { title: t('discover.musicTitle'), subtitle: t('start.discoverDescription') }
    : contentType === 'BEAT'
      ? { title: t('discover.beatsTitle'), subtitle: t('start.discoverDescription') }
      : { title: t('discover.title'), subtitle: t('start.discoverDescription') };
  const allContentTitle = t(contentType === 'BEAT' ? 'discover.allBeats' : contentType === 'MUSIC' ? 'discover.allMusic' : 'discover.allReleases');
  const emptyTitle = t(contentType === 'BEAT' ? 'discover.noBeatsMatch' : 'discover.noReleasesMatch');
  const emptyDescription = t('discover.tryChangingFilters');
  const bpmOptions = [{ value: '', label: t('beats.anyBpm') }, { value: 'under-90', label: '< 90 BPM' },
    { value: '90-119', label: '90-119 BPM' }, { value: '120-149', label: '120-149 BPM' }, { value: '150-plus', label: '150+ BPM' }];
  const sortOptions = [{ value: 'recent', label: t('beats.sortRecent') }, { value: 'played', label: t('beats.sortPlayed') },
    { value: 'liked', label: t('discover.sortLiked') }, { value: 'trending', label: t('discover.trendingWeek') }];
  const activeFilters = [
    ['genre', genre, genre ? getGenreLabel(genre) : ''], ['group', group, QUICK_GROUP_LABELS[group] || group],
    ['style', style, style], ['mood', mood, mood], ['bpm', bpm, bpmOptions.find((item) => item.value === bpm)?.label || bpm],
    ['bpmMin', bpmMin, `BPM >= ${bpmMin}`], ['bpmMax', bpmMax, `BPM <= ${bpmMax}`], ['key', key, key],
    ['sort', sort !== 'recent' ? sort : '', sortOptions.find((item) => item.value === sort)?.label || sort],
  ].filter(([, value]) => value);
  const handleContentTabKeyDown = (event, index) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % CONTENT_TABS.length
      : event.key === 'ArrowLeft' ? (index - 1 + CONTENT_TABS.length) % CONTENT_TABS.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? CONTENT_TABS.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    contentTabRefs.current[next]?.focus();
    setContentType(CONTENT_TABS[next]);
  };
  const loadNextPage = () => { if (!isFetchingNextPage && hasNextPage) fetchNextPage({ cancelRefetch: false }); };

  return <div className="ns-page-stack ns-discover-page">
    <PageMeta title={`${header.title} - NoirSound`} description={header.subtitle} canonical="https://noirsound.co/discover" />
      <header className="ns-discover-header">
        <div>
          <h1 className="ns-page-title">{header.title}</h1>
        </div>
        <div
          className="ns-tabs-scroll flex gap-1 overflow-x-auto border-b border-zinc-800/70"
          role="tablist"
          aria-orientation="horizontal"
          aria-label={t('content.contentType')}
          data-testid="discover-content-tabs"
        >
          {CONTENT_TABS.map((tab, index) => (
            <button
              key={tab}
              ref={(node) => { contentTabRefs.current[index] = node; }}
              id={`discover-tab-${tab.toLowerCase()}`}
              type="button"
              role="tab"
              aria-selected={contentType === tab}
              aria-controls="discover-content-panel"
              tabIndex={contentType === tab ? 0 : -1}
              onClick={() => setContentType(tab)}
              onKeyDown={(event) => handleContentTabKeyDown(event, index)}
              className={`ns-tab min-h-11 shrink-0 border-b-2 px-5 text-sm font-semibold transition-colors ${
                contentType === tab
                  ? 'border-brand-red text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab === 'ALL' ? t('discover.all') : tab === 'MUSIC' ? t('discover.music') : t('discover.beats')}
            </button>
          ))}
        </div>
      </header>

      <div
        id="discover-content-panel"
        role="tabpanel"
        aria-labelledby={`discover-tab-${contentType.toLowerCase()}`}
        className="ns-page-stack space-y-6"
      >

        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <DiscoverVibeBar searchDraft={searchDraft} onSearchChange={(value) => { setSearchDraft(value); if (!value) setQuery('', { replace: true }); }}
              onSearchSubmit={() => setQuery(searchDraft, { replace: true })} searchRef={searchRef} totalResults={total} showVibes={false} />
          </div>
          <button type="button" aria-expanded={filtersOpen} aria-controls="discover-filters" onClick={() => setFiltersOpen((open) => !open)}
            className="ns-button-secondary flex min-h-12 shrink-0 items-center gap-2 px-3 text-sm">
            <SlidersHorizontal size={16} aria-hidden="true" />{t('start.filters')}
          </button>
        </div>
        {filtersOpen && <section id="discover-filters" aria-label={t('discover.filters')} className="rounded-lg border border-[var(--ns-border)] p-4">
          <div className="ns-discover-filter-bar" data-testid={contentType === 'BEAT' ? 'beat-discover-filters' : 'music-discover-filters'}>
            <DiscoverFilterDropdown id="catalog-genre-filter" testId="catalog-genre-trigger" label={t('discover.filterByGenre')} value={genre}
              options={populatedOptions(facets?.genres, genre, t('discover.all'), getGenreLabel)} onChange={setGenre} />
            {contentType === 'BEAT' && <>
              <DiscoverFilterDropdown id="beat-style-filter" testId="beat-filter-style-trigger" label={t('beats.filterStyle')} value={style}
                options={populatedOptions(facets?.styles, style, t('beats.anyStyle'))} onChange={(value) => setBeatFilter('style', value)} />
              <DiscoverFilterDropdown id="beat-mood-filter" testId="beat-filter-mood-trigger" label={t('beats.filterMood')} value={mood}
                options={populatedOptions(facets?.moods, mood, t('beats.anyMood'))} onChange={(value) => setBeatFilter('mood', value)} />
              <DiscoverFilterDropdown id="beat-bpm-filter" testId="beat-filter-bpm-trigger" label={t('beats.filterBpm')} value={bpm}
                options={bpmOptions} onChange={(value) => setBeatFilter('bpm', value)} />
              <DiscoverFilterDropdown id="beat-key-filter" testId="beat-filter-key-trigger" label={t('beats.filterKey')} value={key}
                options={populatedOptions(facets?.keys, key, t('beats.anyKey'))} onChange={(value) => setBeatFilter('key', value)} />
            </>}
          </div>
          {catalogueError && <p role="status" className="mt-3 text-sm text-[var(--ns-text-secondary)]">{t('discover.catalogueUnavailable')}</p>}
        </section>}
        {activeFilters.length > 0 && <div className="ns-discover-active-filters" aria-label={t('discover.activeFilters')}>
          {activeFilters.map(([name, , label]) => <button key={name} type="button" className="ns-discover-filter-chip"
            aria-label={`${t('discover.clearFilter')}: ${label}`}
            onClick={() => name === 'genre' ? setGenre('') : name === 'group' ? setGroup('') : name === 'sort' ? setSort('recent') : setBeatFilter(name, '')}>
            <span>{label}</span><X size={13} aria-hidden="true" />
          </button>)}
          <button type="button" className="ns-discover-clear" onClick={clearFilters}>{t('discover.clearFilters')}</button>
        </div>}
      <DiscoverSection
        id="discover-catalog"
        sectionRef={catalogRef}
        tabIndex={-1}
        title={allContentTitle}
        testId="discover-all-content"
        action={<DiscoverFilterDropdown id="catalog-sort-filter" testId="catalog-sort-trigger" label={t('beats.sort')} value={sort} options={sortOptions} onChange={setSort} align="end" />}
      >
        {catalogueLoading ? (
          <LoadingState type="list" count={8} />
        ) : catalogueError && !firstPage ? (
          <ErrorState
            title={t('discover.catalogueUnavailable')}
            message={catalogueError.message}
            onRetry={() => refetchCatalogue()}
          />
        ) : (
          <>
          <div data-testid="all-releases" className="ns-track-list">
            {filteredCatalogue.length > 0 ? (
              <DiscoverRankedList tracks={filteredCatalogue} />
            ) : (
              <SectionEmpty
                title={emptyTitle}
                description={emptyDescription}
                onReset={hasFilters ? clearFilters : undefined}
                resetLabel={t('discover.clearFilters')}
              />
            )}
          </div>
          {Number.isFinite(total) && <p role="status" data-testid="catalog-results-summary">{t('discover.showingResults', { shown: catalogue.length, total })}</p>}
          {catalogueError && firstPage && (
            <div role="alert">
              <p>{t(isFetchNextPageError ? 'discover.nextPageFailed' : 'discover.catalogueUnavailable')}</p>
              <button type="button" className="ns-button-secondary px-4 py-2 text-sm" disabled={isFetchingNextPage} onClick={() => isFetchNextPageError ? loadNextPage() : refetchCatalogue()}>{t('actions.retry')}</button>
            </div>
          )}
          {hasNextPage && !catalogueError && (
            <button type="button" className="ns-button-secondary self-start px-4 py-2 text-sm" onClick={loadNextPage} disabled={isFetchingNextPage} aria-busy={isFetchingNextPage}>
              {isFetchingNextPage ? t('discover.loadingMore') : t('discover.showMore')}
            </button>
          )}
          {catalogueData?.pages.length > 1 && !hasNextPage && !catalogueError && <p role="status">{t('discover.allResultsLoaded')}</p>}
          {catalogue.length === 0 && total === 0 && !hasFilters && !q && (
            <button type="button" className="ns-button-secondary self-start px-4 text-sm" onClick={() => navigate('/upload')}>
              {t('discover.uploadFirstTrack')}
            </button>
          )}
          </>
        )}
      </DiscoverSection>


      </div>
    </div>;
}
