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
export function useArtistsWithTracks() {
  return useQuery({
    queryKey: ['artists', 'withTracks'],
    queryFn: getArtistsWithTracks,
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
