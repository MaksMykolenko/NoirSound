import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getUploadStatus, uploadTrack } from '../../api/uploads';

export function useUploadTrack() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: uploadTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
  const onPublished = useCallback(() => queryClient.invalidateQueries({ queryKey: ['tracks'] }), [queryClient]);
  return { ...mutation, onPublished };
}

// Hook to poll the upload status
export async function pollUploadStatus(uploadId) {
  return getUploadStatus(uploadId);
}
