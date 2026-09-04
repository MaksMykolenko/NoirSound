import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getTracks,
  getCatalogTracks,
  getDiscoverTracks,
  getLikedTracks,
  getTrendingTracks,
  searchTracks,
} from '../../api/tracks';
import { getRecentlyPlayed } from '../../api/stats';
import { useUserStore } from '../../store/userStore';

function catalogueQueryKey(options = {}) {
  return {
    contentType: options.contentType || 'ALL',
    q: String(options.q ?? options.query ?? '').trim(),
    style: options.style || '',
    mood: options.mood || '',
    key: options.key || '',
    bpm: options.bpm || '',
    bpmMin: options.bpmMin ?? '',
    bpmMax: options.bpmMax ?? '',
    genre: options.genre || '',
    group: options.group || '',
    sort: options.sort || 'recent',
    limit: Number(options.limit || 20),
    page: Number(options.page || 1),
  };
}

export function useTracks(options = {}) {
  const viewer = useUserStore((state) => state.user?.id || 'guest');
  return useQuery({
    queryKey: ['tracks', 'list', viewer, catalogueQueryKey(options)],
    queryFn: ({ signal }) => getTracks(options, { signal }),
  });
}

export function useDiscoverTracks(options = {}) {
  const viewer = useUserStore((state) => state.user?.id || 'guest');
  return useQuery({
    queryKey: ['tracks', 'discover', viewer, catalogueQueryKey(options)],
    queryFn: ({ signal }) => getDiscoverTracks(options, { signal }),
    staleTime: 60_000,
    enabled: options.enabled !== false,
  });
}

export function useTrendingTracks(options = {}) {
  const viewer = useUserStore((state) => state.user?.id || 'guest');
  return useQuery({
    queryKey: ['tracks', 'trending', viewer, catalogueQueryKey({ ...options, sort: 'trending' })],
    queryFn: ({ signal }) => getTrendingTracks(options, { signal }),
    staleTime: 60_000,
    enabled: options.enabled !== false,
  });
}

export function useDiscoverPersonalization({ userId, contentType } = {}) {
  return useQuery({
    queryKey: ['discover', 'personalization', userId || 'guest', contentType || 'ALL'],
    queryFn: async () => {
      const options = contentType && contentType !== 'ALL' ? { contentType } : {};
      const [likedTracks, recentlyPlayed] = await Promise.all([
        getLikedTracks(options),
        getRecentlyPlayed(),
      ]);
      return { likedTracks, recentlyPlayed };
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

export function useSearchTracks(query, options = {}) {
  const viewer = useUserStore((state) => state.user?.id || 'guest');
  return useQuery({
    queryKey: ['tracks', 'search', viewer, catalogueQueryKey({ ...options, q: query })],
    queryFn: ({ signal }) => searchTracks(query, options, { signal }),
    enabled: !!query,
  });
}

export function useCatalogTracks(options = {}) {
  const viewer = useUserStore((state) => state.user?.id || 'guest');
  const params = catalogueQueryKey({ ...options, limit: options.limit || 30 });
  return useInfiniteQuery({
    queryKey: ['tracks', 'catalog', viewer, params],
    queryFn: ({ signal, pageParam }) => getCatalogTracks({ ...params, cursor: pageParam }, { signal }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
    staleTime: 60_000,
    retry: false,
    enabled: options.enabled !== false,
  });
}

export function useCatalogSelection(options = {}) {
  const viewer = useUserStore((state) => state.user?.id || 'guest');
  const params = catalogueQueryKey(options);
  return useQuery({
    queryKey: ['tracks', 'catalog-selection', viewer, params],
    queryFn: ({ signal }) => getCatalogTracks(params, { signal }),
    staleTime: 60_000,
    retry: false,
    enabled: options.enabled !== false,
  });
}
