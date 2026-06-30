import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getUploadStatus, uploadTrack } from '../../api/uploads';

export function useUploadTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
}

// Hook to poll the upload status
export async function pollUploadStatus(uploadId) {
  return getUploadStatus(uploadId);
}
