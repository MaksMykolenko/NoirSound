import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  useDiscoverPersonalization,
  useCatalogTracks,
  useCatalogSelection,
} from '../hooks/queries/useTracks';
import { useArtistsWithTracks } from '../hooks/queries/useArtists';
import useDiscoverUrlState from '../hooks/useDiscoverUrlState';
import { useUserStore } from '../store/userStore';
import ArtistCard from '../components/artists/ArtistCard';
import DiscoverFilterDropdown from '../components/discover/DiscoverFilterDropdown';
import DiscoverRankedList from '../components/discover/DiscoverRankedList';
import DiscoverSection from '../components/discover/DiscoverSection';
import DiscoverTaxonomyTiles from '../components/discover/DiscoverTaxonomyTiles';
import DiscoverTrackRail from '../components/discover/DiscoverTrackRail';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import GenrePicker from '../components/ui/GenrePicker';
import GenrePill from '../components/ui/GenrePill';
import LoadingState from '../components/ui/LoadingState';
import PageMeta from '../components/meta/PageMeta';
import { QUICK_GROUP_LABELS } from '../constants/musicGenres';
import { getGenreLabel } from '../utils/genreLabels';
import { madeForYouTracks } from '../utils/discoverPresentation';

const CONTENT_TABS = ['ALL', 'MUSIC', 'BEAT'];
const CATALOGUE_PAGE_SIZE = 30;

const QUICK_TABS = [
  { id: 'all', kind: 'all' },
  { id: 'popular', kind: 'group', group: 'popular', label: QUICK_GROUP_LABELS.popular },
  { id: 'urban', kind: 'group', group: 'urban', label: QUICK_GROUP_LABELS.urban },
  { id: 'electronic', kind: 'group', group: 'electronic', label: QUICK_GROUP_LABELS.electronic },
  { id: 'rock', kind: 'group', group: 'rock', label: QUICK_GROUP_LABELS.rock },
  { id: 'chill', kind: 'group', group: 'chill', label: QUICK_GROUP_LABELS.chill },
  { id: 'jazz', kind: 'group', group: 'jazz_blues', label: QUICK_GROUP_LABELS.jazz_blues },
  { id: 'world', kind: 'group', group: 'world', label: QUICK_GROUP_LABELS.world },
];

const BEAT_STYLES = [
  'Trap', 'Drill', 'Rage', 'Boom Bap', 'R&B', 'Lo-Fi', 'Jersey', 'Phonk', 'Experimental', 'Other',
];
const BEAT_MOODS = [
  'Dark', 'Aggressive', 'Melodic', 'Chill', 'Sad', 'Nocturnal', 'Energetic', 'Atmospheric',
];

function SectionEmpty({ title, description, onReset, resetLabel }) {
  return (
    <EmptyState
      iconName="AudioLines"
      title={title}
      description={description}
      actionText={onReset ? resetLabel : undefined}
      onAction={onReset}
    />
  );
}

export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const searchRef = useRef(null);
  const catalogRef = useRef(null);
  const catalogNavigation = useRef({ key: null, pending: false });
  const [moreOpen, setMoreOpen] = useState(false);
  const contentTabRefs = useRef([]);
  const {
    contentType,
    q,
    genre,
    group,
    style,
    mood,
    bpm,
    bpmMin,
    bpmMax,
    key,
    sort,
    hasFilters,
    setContentType,
    setQuery,
    setSort,
    setGenre,
    setGroup,
    setBeatFilter,
    clearFilters,
  } = useDiscoverUrlState();
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    setMoreOpen(false);
  }, [contentType]);

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

  const baseContentQuery = contentType === 'ALL' ? {} : { contentType };
  const contentQuery = { ...baseContentQuery, q, genre, group, style, mood, bpm, bpmMin, bpmMax, key };
  const {
    data: catalogueData,
    isLoading: catalogueLoading,
    error: catalogueError,
    refetch: refetchCatalogue,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useCatalogTracks({ ...contentQuery, sort, limit: CATALOGUE_PAGE_SIZE });
  const { data: recentPayload, isLoading: recentLoading, error: recentError, refetch: refetchRecent } = useCatalogSelection({ ...contentQuery, sort: 'recent', limit: 6 });
  const { data: trendingPayload, isLoading: trendingLoading, error: trendingError, refetch: refetchTrending } = useCatalogSelection({ ...contentQuery, sort: 'trending', limit: 10 });
  const { data: freshPayload, isLoading: freshLoading, error: freshError, refetch: refetchFresh } = useCatalogSelection({ ...contentQuery, contentType: 'BEAT', sort: 'recent', limit: 6, enabled: contentType === 'ALL' });
  const {
    data: artistsData,
    isLoading: artistsLoading,
    error: artistsError,
    refetch: refetchArtists,
  } = useArtistsWithTracks({ ...baseContentQuery, sort: 'trending', limit: 6 });
  const { data: personalizationData, isLoading: personalizationLoading } = useDiscoverPersonalization({ userId: user?.id, contentType });

  const leadingSectionsLoading = catalogueLoading || recentLoading || trendingLoading
    || (contentType === 'ALL' && freshLoading) || artistsLoading || personalizationLoading;
  useEffect(() => {
    if (catalogNavigation.current.key !== location.key) {
      const firstVisit = catalogNavigation.current.key === null;
      catalogNavigation.current = {
        key: location.key,
        pending: location.hash === '#discover-catalog' && (firstVisit || navigationType !== 'REPLACE' || location.state?.focusDiscoverCatalog === true),
      };
    }
    if (!catalogNavigation.current.pending || leadingSectionsLoading) return undefined;
    // Wait until leading sections settle and the route's ordinary scroll
    // effects complete. Typing replaces URL state without requesting a jump.
    const frame = window.requestAnimationFrame(() => {
      if (!catalogRef.current) return;
      catalogNavigation.current.pending = false;
      catalogRef.current.focus({ preventScroll: true });
      catalogRef.current.scrollIntoView?.({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [leadingSectionsLoading, location.hash, location.key, location.state?.focusDiscoverCatalog, navigationType]);

  // Preserve server order. Dedupe is only a defensive measure for live ranking
  // updates; it does not replace stable server cursor pagination.
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
  const styleItems = facets?.styles || [];
  const moodItems = facets?.moods || [];
  const keyItems = facets?.keys || [];
  const genreItems = (facets?.genres || []).slice(0, 8);
  const allGenreItems = facets?.genres || [];
  const beatFacetLoading = catalogueLoading;
  const beatFacetError = !firstPage ? catalogueError : null;
  const refetchBeatFacets = refetchCatalogue;
  const genreTilesLoading = catalogueLoading;
  const genreTilesError = !firstPage ? catalogueError : null;
  const creators = (artistsData || []).slice(0, 6);
  const serverTrending = trendingPayload?.items || [];
  const trendingTracks = serverTrending;
  const newReleases = recentPayload?.items || [];
  const freshBeats = freshPayload?.items || [];
  const personalized = useMemo(() => {
    if (!user || !personalizationData) return [];
    return madeForYouTracks(recentPayload?.items || [], {
      likedTracks: personalizationData.likedTracks || [],
      recentlyPlayed: personalizationData.recentlyPlayed || [],
      limit: 6,
    });
  }, [personalizationData, recentPayload, user]);

  const catalogHref = (overrides) => {
    const next = new URLSearchParams(location.search);
    next.delete('view'); next.delete('contentType'); next.delete('cursor'); next.delete('page');
    if (contentType === 'ALL') next.delete('content');
    else next.set('content', contentType);
    for (const [name, value] of Object.entries(overrides)) {
      if (value && value !== 'ALL') next.set(name, value);
      else next.delete(name);
    }
    if (overrides.content && overrides.content !== 'BEAT') {
      for (const name of ['style', 'mood', 'bpm', 'bpmMin', 'bpmMax', 'key']) next.delete(name);
    }
    return `/discover?${next}#discover-catalog`;
  };
  const viewAll = (overrides) => <Link className="ns-discover-clear" to={catalogHref(overrides)} state={{ focusDiscoverCatalog: true }}>{t('discover.viewAll')}</Link>;

  const header = contentType === 'MUSIC'
    ? { title: t('discover.musicTitle'), subtitle: t('discover.musicSubtitle') }
    : contentType === 'BEAT'
      ? { title: t('discover.beatsTitle'), subtitle: t('discover.beatsSubtitle') }
      : { title: t('discover.title'), subtitle: t('discover.subtitle') };
  const isRecentWindow = trendingPayload?.meta?.trendingWindowDays === 7;
  const topTitle = contentType === 'BEAT' ? t('discover.freshBeats') : !isRecentWindow ? t('discover.mostPlayed') : contentType === 'MUSIC' ? t('discover.trendingTracks') : t('discover.trendingNow');
  const topTracks = (contentType === 'BEAT' ? newReleases : trendingTracks).slice(0, 4);
  const rankedTitle = isRecentWindow ? t('discover.trendingWeek') : t('discover.mostPlayed');
  const allContentTitle = contentType === 'BEAT'
    ? t('discover.allBeats')
    : contentType === 'MUSIC'
      ? t('discover.allMusic')
      : t('discover.allReleases');
  const emptyTitle = contentType === 'BEAT'
    ? t('discover.noBeatsMatch')
    : t('discover.noReleasesMatch');
  const emptyDescription = contentType === 'BEAT'
    ? t('discover.tryChangingBeatFilters')
    : t('discover.tryChangingFilters');

  const styleOptions = [
    { value: '', label: t('beats.anyStyle') },
    ...BEAT_STYLES.map((value) => ({
      value,
      label: value,
      hint: styleItems.find((item) => item.value.toLowerCase() === value.toLowerCase())?.count ?? (facets && !facets.meta?.truncated?.styles ? 0 : undefined),
    })),
    ...styleItems
      .filter((item) => !BEAT_STYLES.some((value) => value.toLowerCase() === item.value.toLowerCase()))
      .map((item) => ({ value: item.value, label: item.label, hint: item.count })),
  ];
  const moodOptions = [
    { value: '', label: t('beats.anyMood') },
    ...BEAT_MOODS.map((value) => ({
      value,
      label: value,
      hint: moodItems.find((item) => item.value.toLowerCase() === value.toLowerCase())?.count ?? (facets && !facets.meta?.truncated?.moods ? 0 : undefined),
    })),
    ...moodItems
      .filter((item) => !BEAT_MOODS.some((value) => value.toLowerCase() === item.value.toLowerCase()))
      .map((item) => ({ value: item.value, label: item.label, hint: item.count })),
  ];
  const keyOptions = [
    { value: '', label: t('beats.anyKey') },
    ...keyItems.map((item) => ({ value: item.value, label: item.value, hint: item.count })),
  ];
  const bpmOptions = [
    { value: '', label: t('beats.anyBpm') },
    { value: 'under-90', label: '< 90 BPM' },
    { value: '90-119', label: '90–119 BPM' },
    { value: '120-149', label: '120–149 BPM' },
    { value: '150-plus', label: '150+ BPM' },
  ];
  const sortOptions = [
    { value: 'recent', label: t('beats.sortRecent') },
    { value: 'played', label: t('beats.sortPlayed') },
    { value: 'liked', label: t('discover.sortLiked') },
    { value: 'trending', label: t('discover.trendingWeek') },
  ];

  const isQuickTabActive = (tab) => {
    if (tab.kind === 'all') return !genre && !group;
    return !genre && group === tab.group;
  };

  const handleContentTabKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % CONTENT_TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + CONTENT_TABS.length) % CONTENT_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = CONTENT_TABS.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    contentTabRefs.current[nextIndex]?.focus();
    setContentType(CONTENT_TABS[nextIndex]);
  };

  const topLoading = contentType === 'BEAT' ? recentLoading : trendingLoading;
  const topError = contentType === 'BEAT' ? recentError : trendingError;
  const loadNextPage = () => {
    if (!isFetchingNextPage && hasNextPage) fetchNextPage({ cancelRefetch: false });
  };

  return (
    <div className="ns-page-stack ns-discover-page">
      <PageMeta
        title={`${header.title} · NoirSound`}
        description={header.subtitle}
        canonical="https://noirsound.co/discover"
      />

      <header className="ns-discover-header">
        <div>
          <h1 className="ns-page-title">{header.title}</h1>
          <p className="ns-page-lede">{header.subtitle}</p>
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
        className="ns-page-stack"
      >
      <form role="search" onSubmit={(event) => { event.preventDefault(); setQuery(searchDraft, { replace: true }); }}>
        <label className="sr-only" htmlFor="discover-search">{t('discover.searchLabel')}</label>
        <input
          ref={searchRef}
          id="discover-search"
          data-testid="discover-search"
          type="search"
          maxLength={120}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder={t('header.searchPlaceholder')}
          className="ns-field w-full px-4 py-2 text-sm"
        />
      </form>
      <section className="ns-discover-context" aria-label={t('discover.filters')}>
        {contentType === 'BEAT' ? (
          <>
            <div className="ns-discover-filter-bar" data-testid="beat-discover-filters">
              <DiscoverFilterDropdown
                id="beat-genre-filter"
                testId="beat-filter-genre-trigger"
                label={t('discover.filterByGenre')}
                value={genre}
                options={[{ value: '', label: t('discover.all') }, ...allGenreItems.map((item) => ({ ...item, hint: item.count }))]}
                onChange={setGenre}
              />
              <DiscoverFilterDropdown
                id="beat-style-filter"
                testId="beat-filter-style-trigger"
                label={t('beats.filterStyle')}
                value={style}
                options={styleOptions}
                onChange={(value) => setBeatFilter('style', value)}
              />
              <DiscoverFilterDropdown
                id="beat-mood-filter"
                testId="beat-filter-mood-trigger"
                label={t('beats.filterMood')}
                value={mood}
                options={moodOptions}
                onChange={(value) => setBeatFilter('mood', value)}
              />
              <DiscoverFilterDropdown
                id="beat-bpm-filter"
                testId="beat-filter-bpm-trigger"
                label={t('beats.filterBpm')}
                value={bpm}
                options={bpmOptions}
                onChange={(value) => setBeatFilter('bpm', value)}
              />
              <DiscoverFilterDropdown
                id="beat-key-filter"
                testId="beat-filter-key-trigger"
                label={t('beats.filterKey')}
                value={key}
                options={keyOptions}
                onChange={(value) => setBeatFilter('key', value)}
              />
              <span className="ns-discover-filter-spacer" aria-hidden="true" />
              <DiscoverFilterDropdown
                id="beat-sort-filter"
                testId="beat-filter-sort-trigger"
                label={t('beats.sort')}
                value={sort}
                options={sortOptions}
                onChange={(value) => setBeatFilter('sort', value)}
                align="end"
              />
            </div>

            {hasFilters && (
              <div className="ns-discover-active-filters" aria-label={t('discover.activeFilters')}>
                {[
                  ['genre', genre, genre ? getGenreLabel(genre) : ''],
                  ['group', group, QUICK_GROUP_LABELS[group] || group],
                  ['style', style, style],
                  ['mood', mood, mood],
                  ['bpm', bpm, bpmOptions.find((item) => item.value === bpm)?.label],
                  ['bpmMin', bpmMin, `≥ ${bpmMin} BPM`],
                  ['bpmMax', bpmMax, `≤ ${bpmMax} BPM`],
                  ['key', key, key],
                ].filter(([, value]) => value).map(([filterKey, , label]) => (
                  <button
                    key={filterKey}
                    type="button"
                    className="ns-discover-filter-chip"
                    onClick={() => filterKey === 'genre' ? setGenre('') : filterKey === 'group' ? setGroup('') : setBeatFilter(filterKey, '')}
                    aria-label={`${t('discover.clearFilter')}: ${label}`}
                  >
                    <span>{label}</span>
                    <X size={13} aria-hidden="true" />
                  </button>
                ))}
                <button type="button" className="ns-discover-clear" onClick={clearFilters}>
                  {t('discover.clearFilters')}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div
              data-testid="genre-quick-tabs"
              className="ns-tabs-scroll -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
              aria-label={t('discover.filterByGenre')}
            >
              {QUICK_TABS.map((tab) => (
                <GenrePill
                  key={tab.id}
                  label={tab.kind === 'all' ? t('discover.all') : tab.label}
                  active={isQuickTabActive(tab)}
                  onClick={() => {
                    if (tab.kind === 'all') clearFilters();
                    else setGroup(tab.group);
                    setMoreOpen(false);
                  }}
                />
              ))}
              <GenrePill
                label={t('discover.viewAll')}
                active={moreOpen || Boolean(genre)}
                onClick={() => setMoreOpen((value) => !value)}
              />
            </div>
            {moreOpen && (
              <div data-testid="genre-more-panel" className="max-w-sm">
                <GenrePicker
                  value={genre}
                  onChange={(value) => setGenre(value)}
                  ariaLabel={t('discover.exploreGenres')}
                  placeholder={t('discover.exploreGenres')}
                />
              </div>
            )}
            {(genre || group) && (
              <div className="ns-discover-active-filters">
                <button
                  type="button"
                  data-testid="active-genre-chip"
                  className="ns-chip ns-discover-filter-chip"
                  onClick={clearFilters}
                  aria-label={`${t('discover.clearFilter')}: ${genre ? getGenreLabel(genre) : QUICK_GROUP_LABELS[group]}`}
                >
                  <span>{genre ? getGenreLabel(genre) : QUICK_GROUP_LABELS[group]}</span>
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <div className="ns-discover-lead-grid">
        <DiscoverSection title={topTitle} testId="discover-trending" action={viewAll({ sort: contentType === 'BEAT' ? 'recent' : 'trending' })}>
          {topLoading ? (
            <LoadingState type="grid" count={4} />
          ) : topError ? (
            <ErrorState
              title={t('discover.catalogueUnavailable')}
              message={topError.message}
              onRetry={() => {
                if (contentType === 'BEAT') refetchRecent();
                else refetchTrending();
              }}
            />
          ) : topTracks.length > 0 ? (
            <div data-testid="featured-tracks">
              <DiscoverTrackRail tracks={topTracks} featured />
            </div>
          ) : (
            <SectionEmpty
              title={emptyTitle}
              description={emptyDescription}
              onReset={hasFilters ? clearFilters : undefined}
              resetLabel={t('discover.clearFilters')}
            />
          )}
        </DiscoverSection>

        <DiscoverSection
          title={rankedTitle}
          action={viewAll({ sort: 'trending' })}
          testId="discover-trending-week"
          className="ns-discover-ranked-section"
        >
          {trendingLoading && trendingTracks.length === 0 ? (
            <LoadingState type="list" count={5} />
          ) : trendingTracks.length > 0 ? (
            <DiscoverRankedList tracks={trendingTracks.slice(0, 7)} compact />
          ) : trendingError ? (
            <ErrorState
              title={t('discover.noTrendingYet')}
              message={trendingError.message}
              onRetry={() => refetchTrending()}
            />
          ) : (
            <SectionEmpty
              title={t('discover.noTrendingYet')}
              description={t('discover.noTrendingDescription')}
            />
          )}
          {trendingError && trendingTracks.length > 0 && (
            <button type="button" className="ns-discover-retry" onClick={() => refetchTrending()}>
              {t('actions.retry')}
            </button>
          )}
        </DiscoverSection>
      </div>

      {contentType !== 'BEAT' && (
        <DiscoverSection title={t('discover.newReleases')} testId="discover-new-releases" action={viewAll({ sort: 'recent' })}>
          {recentLoading ? (
            <LoadingState type="grid" count={6} />
          ) : recentError ? (
            <ErrorState
              title={t('discover.catalogueUnavailable')}
              message={recentError.message}
              onRetry={() => refetchRecent()}
            />
          ) : newReleases.length > 0 ? (
            <DiscoverTrackRail tracks={newReleases} />
          ) : (
            <SectionEmpty
              title={t('discover.noNewReleases')}
              description={t('discover.noNewReleasesDescription')}
            />
          )}
        </DiscoverSection>
      )}

      {contentType === 'ALL' && (
        <DiscoverSection title={t('discover.freshBeats')} testId="discover-fresh-beats" action={viewAll({ content: 'BEAT', sort: 'recent' })}>
          {freshLoading ? (
            <LoadingState type="grid" count={6} />
          ) : freshError ? (
            <ErrorState
              title={t('discover.catalogueUnavailable')}
              message={freshError.message}
              onRetry={() => refetchFresh()}
            />
          ) : freshBeats.length > 0 ? (
            <DiscoverTrackRail tracks={freshBeats} />
          ) : (
            <SectionEmpty
              title={t('discover.noFreshBeats')}
              description={t('discover.noFreshBeatsDescription')}
            />
          )}
        </DiscoverSection>
      )}

      {personalized.length > 0 && (
        <DiscoverSection
          title={t('discover.madeForYou')}
          description={t('discover.madeForYouDescription')}
          testId="discover-made-for-you"
        >
          <DiscoverTrackRail tracks={personalized} />
        </DiscoverSection>
      )}

      {contentType === 'BEAT' && (
        <>
          <DiscoverSection title={t('discover.browseStyles')} testId="discover-style-tiles">
            {beatFacetLoading ? (
              <LoadingState type="grid" count={6} />
            ) : beatFacetError ? (
              <ErrorState
                title={t('discover.catalogueUnavailable')}
                message={beatFacetError.message}
                onRetry={() => refetchBeatFacets()}
              />
            ) : styleItems.length > 0 ? (
              <DiscoverTaxonomyTiles
                items={styleItems.slice(0, 9)}
                activeValue={style}
                onSelect={(value) => setBeatFilter('style', value)}
                ariaLabel={t('discover.browseStyles')}
                variant="style"
              />
            ) : (
              <SectionEmpty
                title={t('discover.noStylesYet')}
                description={t('discover.noStylesDescription')}
              />
            )}
          </DiscoverSection>

          <DiscoverSection title={t('discover.browseMoods')} testId="discover-mood-tiles">
            {beatFacetLoading ? (
              <LoadingState type="grid" count={6} />
            ) : beatFacetError ? (
              <ErrorState
                title={t('discover.catalogueUnavailable')}
                message={beatFacetError.message}
                onRetry={() => refetchBeatFacets()}
              />
            ) : moodItems.length > 0 ? (
              <DiscoverTaxonomyTiles
                items={moodItems.slice(0, 8)}
                activeValue={mood}
                onSelect={(value) => setBeatFilter('mood', value)}
                ariaLabel={t('discover.browseMoods')}
                variant="mood"
              />
            ) : (
              <SectionEmpty
                title={t('discover.noMoodsYet')}
                description={t('discover.noMoodsDescription')}
              />
            )}
          </DiscoverSection>
        </>
      )}

      {contentType !== 'BEAT' && (
        <DiscoverSection title={t('discover.exploreGenres')} testId="discover-genre-tiles">
          {genreTilesLoading ? (
            <LoadingState type="grid" count={8} />
          ) : genreTilesError ? (
            <ErrorState
              title={t('discover.catalogueUnavailable')}
              message={genreTilesError.message}
              onRetry={() => refetchCatalogue()}
            />
          ) : genreItems.length > 0 ? (
            <DiscoverTaxonomyTiles
              items={genreItems}
              activeValue={genre}
              onSelect={setGenre}
              ariaLabel={t('discover.exploreGenres')}
              variant="genre"
            />
          ) : (
            <SectionEmpty
              title={t('discover.noGenresYet')}
              description={t('discover.noGenresDescription')}
            />
          )}
        </DiscoverSection>
      )}

      <DiscoverSection
        title={contentType === 'BEAT' ? t('discover.producersToWatch') : t('discover.artistsToWatch')}
        testId="discover-creators"
      >
        {artistsLoading ? (
          <LoadingState type="grid" count={4} />
        ) : artistsError ? (
          <ErrorState
            title={t('discover.creatorsUnavailable')}
            message={artistsError.message}
            onRetry={() => refetchArtists()}
          />
        ) : creators.length > 0 ? (
          <div data-testid="recommended-artists" className="ns-discover-creator-rail">
            {creators.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                roleLabel={contentType === 'BEAT' ? t('discover.producer') : t('discover.artist')}
                metric="followers"
              />
            ))}
          </div>
        ) : (
          <SectionEmpty
            title={contentType === 'BEAT' ? t('discover.noProducersYet') : t('discover.noArtistsYet')}
            description={t('discover.noCreatorsDescription')}
          />
        )}
      </DiscoverSection>

      <DiscoverSection
        id="discover-catalog"
        sectionRef={catalogRef}
        tabIndex={-1}
        title={allContentTitle}
        description={t('discover.allContentDescription')}
        testId="discover-all-content"
        action={contentType !== 'BEAT' ? <DiscoverFilterDropdown id="catalog-sort-filter" testId="catalog-sort-trigger" label={t('beats.sort')} value={sort} options={sortOptions} onChange={setSort} align="end" /> : undefined}
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
          {catalogue.length > 0 && !hasNextPage && !catalogueError && <p role="status">{t('discover.allResultsLoaded')}</p>}
          {catalogue.length === 0 && total === 0 && !hasFilters && !q && (
            <button type="button" className="ns-button-secondary self-start px-4 text-sm" onClick={() => navigate('/upload')}>
              {t('discover.uploadFirstTrack')}
            </button>
          )}
          </>
        )}
      </DiscoverSection>

      <div className="sr-only" aria-live="polite">
        <SlidersHorizontal size={14} aria-hidden="true" />
        {Number.isFinite(total) ? t('discover.resultsCount', { count: total }) : ''}
      </div>
      </div>
    </div>
  );
}
