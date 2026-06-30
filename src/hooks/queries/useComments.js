import { useQuery } from '@tanstack/react-query';
import { getCommentsForTrack } from '../../api/comments';

export function useComments(trackId) {
  return useQuery({
    queryKey: ['comments', trackId],
    queryFn: () => getCommentsForTrack(trackId),
    enabled: !!trackId,
  });
}
