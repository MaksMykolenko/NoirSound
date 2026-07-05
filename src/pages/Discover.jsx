import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDiscoverTracks } from '../hooks/queries/useTracks';
import { useArtistsWithTracks } from '../hooks/queries/useArtists';
import GenrePill from '../components/ui/GenrePill';
import GenrePicker from '../components/ui/GenrePicker';
import TrackCard from '../components/tracks/TrackCard';
import TrackListItem from '../components/tracks/TrackListItem';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import FallbackAvatar from '../components/ui/FallbackAvatar';
import { normalizeGenre, getGroupOf, isGenreGroup, QUICK_GROUP_LABELS } from '../constants/musicGenres';
import { getGenreLabel } from '../utils/genreLabels';
import { formatNumber } from '../utils/formatLocale';
import {
  rankRecommendedArtists,
  selectFeaturedTracks,
  sortTracksNewest,
} from '../utils/presentation';

// Quick-filter tabs: a small, curated set of groups so the bar never overflows
// on mobile. The full taxonomy lives behind the "More" picker.
//
// Tab labels are genre-group NAMES, so they are always English (see
// NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md) — only "All" is translated via i18n,
// since it's UI chrome, not a taxonomy term.
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

const ALL_FILTER = { kind: 'all' };

function filterFromQuery(genreParam, groupParam) {
  const genre = normalizeGenre(genreParam);
  if (genre) return { kind: 'genre', key: genre };

  if (isGenreGroup(groupParam)) return { kind: 'group', group: groupParam };

  return ALL_FILTER;
}

export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedGenre = searchParams.get('genre');
  const requestedGroup = searchParams.get('group');
  const browseAllRequested = searchParams.get('browse') === 'all';
  const [filter, setFilter] = useState(() => filterFromQuery(requestedGenre, requestedGroup));
  const [moreOpen, setMoreOpen] = useState(() => browseAllRequested);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setFilter(filterFromQuery(requestedGenre, requestedGroup));
    setMoreOpen(browseAllRequested);
  }, [browseAllRequested, requestedGenre, requestedGroup]);

  const { data: tracksData, isLoading: tracksLoading, error: tracksError } = useDiscoverTracks();
  const { data: artistsData, isLoading: artistsLoading, error: artistsError } = useArtistsWithTracks();

  const tracks = useMemo(() => sortTracksNewest(tracksData || []), [tracksData]);
  const artists = useMemo(
    () => rankRecommendedArtists(artistsData || [], tracks),
    [artistsData, tracks]
  );

  const filteredTracks = useMemo(() => {
    const matchesGenreFilter = (track) => {
      if (filter.kind === 'all') return true;
      if (filter.kind === 'genre') return normalizeGenre(track.genre) === filter.key;
      return getGroupOf(track.genre) === filter.group; // group
    };

    const query = searchQuery.trim().toLowerCase();
    const querySlug = query.replace(/[\s-]+/g, '_');
    return tracks.filter((track) => {
      if (!matchesGenreFilter(track)) return false;
      if (!query) return true;

      const genreKey = normalizeGenre(track.genre);
      return (
        (track.title && track.title.toLowerCase().includes(query))
        || (track.artistName && track.artistName.toLowerCase().includes(query))
        || (track.genre && track.genre.toLowerCase().includes(query))
        || (genreKey && genreKey.includes(querySlug))
        || (genreKey && getGenreLabel(genreKey).toLowerCase().includes(query))
        || (track.tags && track.tags.some((tag) => tag.toLowerCase().includes(query)))
      );
    });
  }, [tracks, filter, searchQuery]);

  const recommendedArtists = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return artists;
    return artists.filter((artist) => {
      return (
        (artist.name && artist.name.toLowerCase().includes(query))
        || (artist.username && artist.username.toLowerCase().includes(query))
        || (artist.genres && artist.genres.some((g) => g.toLowerCase().includes(query)))
      );
    });
  }, [artists, searchQuery]);

  const featuredTracks = useMemo(() => selectFeaturedTracks(filteredTracks, 4), [filteredTracks]);
  const listTracks = useMemo(() => filteredTracks.slice(0, 10), [filteredTracks]);

  const clearAll = () => {
    setSearchQuery('');
    setFilter(ALL_FILTER);
    setMoreOpen(false);
  };

  const isTabActive = (tab) => {
    if (tab.kind === 'all') return filter.kind === 'all';
    return filter.kind === 'group' && filter.group === tab.group;
  };

  const selectedGenreKey = filter.kind === 'genre' ? filter.key : '';

  // Empty state for the featured grid (no upload CTA — that lives in the list).
  const renderFeaturedEmpty = () => {
    if (tracks.length === 0) {
      return (
        <EmptyState
          iconName="AudioLines"
          title={t('empty.noReleasesYet')}
          description={t('empty.noTracksYet')}
        />
      );
    }
    const hasSearch = Boolean(searchQuery.trim());
    return (
      <EmptyState
        iconName="SearchX"
        title={hasSearch && filter.kind === 'all'
          ? t('discover.styleEmptyTitle')
          : t('discover.genreEmptyTitle')}
        description={filter.kind === 'all' ? t('empty.noTracksYet') : t('discover.genreEmptyDesc')}
        actionText={t('actions.clearFilters')}
        onAction={clearAll}
      />
    );
  };

  // Empty state for the All-releases list (carries the upload CTA).
  const renderListEmpty = () => {
    if (tracks.length === 0) {
      return (
        <EmptyState
          iconName="UploadCloud"
          title={t('empty.noReleasesYet')}
          description={t('discover.publishedTracksAppear')}
          actionText={t('discover.uploadFirstTrack')}
          onAction={() => navigate('/upload')}
        />
      );
    }
    const hasSearch = Boolean(searchQuery.trim());
    if (hasSearch && filter.kind === 'all') {
      return (
        <EmptyState
          iconName="SearchX"
          title={t('discover.styleEmptyTitle')}
          description={t('empty.noTracksYet')}
          actionText={t('actions.clearFilters')}
          onAction={clearAll}
        />
      );
    }
    return (
      <EmptyState
        iconName="AudioLines"
        title={t('discover.genreEmptyTitle')}
        description={t('discover.genreEmptyDesc')}
        actionText={t('actions.clearFilters')}
        onAction={clearAll}
      />
    );
  };

  const isLoading = tracksLoading || artistsLoading;
  const error = tracksError || artistsError;

  if (isLoading) {
    return (
      <div className="ns-page-stack">
        <LoadingState type="list" count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState title="Discover is unavailable" message={error.message} />
    );
  }

  return (
    <div className="ns-page-stack animate-fade-in">
      {/* Page Title Header */}
      <div>
        <h1 className="ns-page-title">{t('discover.title')}</h1>
        <p className="ns-page-lede">{t('discover.subtitle')}</p>
      </div>

      {/* Search and filters */}
      <div className="ns-card p-3 sm:p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={17} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('header.searchPlaceholder')}
              className="ns-field pl-11 pr-4 text-sm"
              aria-label="Search releases"
            />
          </div>
          <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <SlidersHorizontal size={15} />
            <span>{t('discover.resultsCount', { count: filteredTracks.length })}</span>
          </div>
        </div>

        {/* Quick group tabs — wrap on mobile so nothing is clipped */}
        <div
          data-testid="genre-quick-tabs"
          className="flex flex-wrap items-center gap-2"
          aria-label={t('discover.filterByGenre')}
        >
          {QUICK_TABS.map((tab) => (
            <GenrePill
              key={tab.id}
              label={tab.kind === 'all' ? t('discover.tabs.all') : tab.label}
              active={isTabActive(tab)}
              onClick={() => {
                setFilter(tab.kind === 'all' ? ALL_FILTER : { kind: 'group', group: tab.group });
                setMoreOpen(false);
              }}
            />
          ))}
          <GenrePill
            label={t('discover.tabs.more')}
            active={moreOpen || filter.kind === 'genre'}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </GenrePill>
        </div>

        {/* "More" opens the full, searchable, grouped taxonomy */}
        {moreOpen && (
          <div data-testid="genre-more-panel" className="pt-1">
            <GenrePicker
              value={selectedGenreKey}
              onChange={(key) => {
                setFilter(key ? { kind: 'genre', key } : ALL_FILTER);
              }}
              ariaLabel={t('discover.browseAllGenres')}
              placeholder={t('discover.browseAllGenres')}
            />
          </div>
        )}

        {/* Active specific-genre chip (the whole chip is the remove control) */}
        {filter.kind === 'genre' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="active-genre-chip"
              onClick={clearAll}
              aria-label={`${t('discover.clearGenre')}: ${getGenreLabel(filter.key)}`}
              className="group inline-flex items-center gap-1.5 max-w-full pl-3 pr-2 py-1.5 rounded-full bg-brand-red/15 border border-brand-red/30 text-xs font-semibold text-rose-200 hover:bg-brand-red/25 hover:border-brand-red/50 transition-colors cursor-pointer"
            >
              <span className="truncate">{getGenreLabel(filter.key)}</span>
              <X size={13} className="shrink-0 text-rose-300 group-hover:text-zinc-100" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Grid: Featured in Genre */}
      <section className="space-y-4">
        <h2 className="ns-eyebrow">{t('discover.featured')}</h2>
        {featuredTracks.length === 0 ? (
          renderFeaturedEmpty()
        ) : (
          <div data-testid="featured-tracks" className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {featuredTracks.map((track) => (
              <TrackCard key={track.id} track={track} tracksContext={filteredTracks} />
            ))}
          </div>
        )}
      </section>

      {/* Grid: Artists + List of Tracks Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left 2 Cols: Tracks list */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="ns-eyebrow">{t('discover.allReleases')}</h2>
          <div data-testid="all-releases" className="ns-card p-2 sm:p-4 space-y-1">
            {listTracks.length === 0 ? (
              renderListEmpty()
            ) : (
              listTracks.map((track, index) => (
                <TrackListItem
                  key={track.id}
                  track={track}
                  index={index}
                  tracksContext={listTracks}
                />
              ))
            )}
          </div>
        </section>

        {/* Right 1 Col: Recommended artists */}
        <section className="space-y-4">
          <h2 className="ns-eyebrow">{t('discover.recommendedArtists')}</h2>
          {recommendedArtists.length === 0 ? (
            <EmptyState
              iconName="Users"
              title={t('discover.noCreatorsYet')}
              description={t('discover.moreCreatorsAppear')}
            />
          ) : (
            <div data-testid="recommended-artists" className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-1 gap-4">
              {recommendedArtists.slice(0, 3).map((artist) => (
                <div
                  key={artist.id}
                  data-artist-id={artist.id}
                  onClick={() => navigate(`/artist/${artist.id}`)}
                  className="flex items-center space-x-3.5 p-3.5 min-h-16 ns-card ns-card-interactive cursor-pointer"
                >
                  <FallbackAvatar
                    src={artist.avatarUrl}
                    name={artist.name}
                    className="w-10 h-10 rounded-full border border-zinc-800 shrink-0 text-[34px]"
                    imageClassName="object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-zinc-200 truncate">{artist.name}</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                      {formatNumber(artist.followers || 0)} followers
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
