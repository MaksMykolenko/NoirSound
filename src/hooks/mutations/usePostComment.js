import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postComment } from '../../api/comments';
import { useUserStore } from '../../store/userStore';

export function usePostComment(trackId) {
  const queryClient = useQueryClient();
  const user = useUserStore((state) => state.user);

  return useMutation({
    mutationFn: (text) => postComment(trackId, text, user),
    onMutate: async (newText) => {
      // Cancel any outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['comments', trackId] });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData(['comments', trackId]);

      // Optimistically update to the new value
      queryClient.setQueryData(['comments', trackId], (old) => {
        const tempId = `temp-${Date.now()}`;
        const newComment = {
          id: tempId,
          trackId,
          userId: user?.id || 'guest',
          displayName: user?.displayName || 'Guest User',
          username: user?.username || 'guest',
          avatarUrl: user?.avatarUrl || null,
          text: newText,
          likes: 0,
          likedByCurrentUser: false,
          createdAt: 'Just now',
          replies: []
        };
        return [newComment, ...(old || [])];
      });

      // Return a context object with the snapshotted value
      return { previousComments };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, newText, context) => {
      queryClient.setQueryData(['comments', trackId], context.previousComments);
    },
    // Always refetch after error or success:
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', trackId] });
    },
  });
}
