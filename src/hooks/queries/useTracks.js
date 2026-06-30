import { useQuery } from '@tanstack/react-query';
import { getTracks, getDiscoverTracks, searchTracks } from '../../api/tracks';

export function useTracks() {
  return useQuery({
    queryKey: ['tracks'],
    queryFn: getTracks,
  });
}

export function useDiscoverTracks() {
  return useQuery({
    queryKey: ['tracks', 'discover'],
    queryFn: getDiscoverTracks,
  });
}

export function useSearchTracks(query) {
  return useQuery({
    queryKey: ['tracks', 'search', query],
    queryFn: () => searchTracks(query),
    enabled: !!query,
  });
}
