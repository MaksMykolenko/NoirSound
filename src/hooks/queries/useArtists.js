import { useQuery } from '@tanstack/react-query';
import { getArtists, getArtistById, getArtistsWithTracks } from '../../api/artists';
import { getTracksByArtist } from '../../api/tracks';

export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: getArtists,
  });
}

/** Returns only artists with at least one published track. */
export function useArtistsWithTracks(options = {}) {
  return useQuery({
    queryKey: ['artists', 'withTracks', options.contentType || 'ALL'],
    queryFn: () => getArtistsWithTracks(options),
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
