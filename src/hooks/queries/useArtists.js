import { useQuery } from '@tanstack/react-query';
import { getArtists, getArtistById, getArtistsWithTracks } from '../../api/artists';
import { getTracksByArtist } from '../../api/tracks';
import { useUserStore } from '../../store/userStore';

export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: getArtists,
  });
}

/** Returns only artists with at least one published track. */
export function useArtistsWithTracks(options = {}) {
  const viewer = useUserStore((state) => state.user?.id || 'guest');
  return useQuery({
    queryKey: ['artists', 'withTracks', viewer, { contentType: options.contentType || 'ALL', sort: options.sort || '', limit: options.limit || null }],
    queryFn: ({ signal }) => getArtistsWithTracks(options, { signal }),
    staleTime: 120_000,
  });
}

export function useArtist(id) {
  return useQuery({
    queryKey: ['artist', id],
    queryFn: () => getArtistById(id),
    enabled: !!id,
  });
}

export function useArtistTracks(id) {
  return useQuery({
    queryKey: ['artist', id, 'tracks'],
    queryFn: () => getTracksByArtist(id),
    enabled: !!id,
  });
}
