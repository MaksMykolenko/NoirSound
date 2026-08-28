import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getTracks, getDiscoverTracks, searchTracks } from '../../api/tracks';

export function useTracks(options = {}) {
  return useQuery({
    queryKey: ['tracks', options?.contentType || 'ALL', options?.query || ''],
    queryFn: () => getTracks(options),
  });
}

export function useDiscoverTracks(options = {}) {
  return useQuery({
    queryKey: ['tracks', 'discover', options?.contentType || 'ALL', options?.query || ''],
    queryFn: () => getDiscoverTracks(options),
    placeholderData: keepPreviousData,
  });
}

export function useSearchTracks(query, options = {}) {
  return useQuery({
    queryKey: ['tracks', 'search', query, options?.contentType || 'ALL'],
    queryFn: () => searchTracks(query, { ...options, query }),
    enabled: !!query,
  });
}
