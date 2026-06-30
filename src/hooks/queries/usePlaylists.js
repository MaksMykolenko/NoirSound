import { useQuery } from '@tanstack/react-query';
import { getPlaylists, getPlaylistById } from '../../api/playlists';

export function usePlaylists() {
  return useQuery({
    queryKey: ['playlists'],
    queryFn: getPlaylists,
  });
}

export function usePlaylist(id) {
  return useQuery({
    queryKey: ['playlist', id],
    queryFn: () => getPlaylistById(id),
    enabled: !!id,
  });
}
