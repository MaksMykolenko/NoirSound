import { useQuery } from '@tanstack/react-query';
import { getTrackById } from '../../api/tracks';

export function useTrack(id) {
  return useQuery({
    queryKey: ['track', id],
    queryFn: () => getTrackById(id),
    enabled: !!id,
  });
}
