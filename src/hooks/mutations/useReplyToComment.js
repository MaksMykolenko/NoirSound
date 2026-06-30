import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postReply } from '../../api/comments';
import { useUserStore } from '../../store/userStore';

export function useReplyToComment(trackId) {
  const queryClient = useQueryClient();
  const user = useUserStore((state) => state.user);

  return useMutation({
    mutationFn: ({ commentId, text }) => postReply(commentId, text, user),
    onMutate: async ({ commentId, text }) => {
      await queryClient.cancelQueries({ queryKey: ['comments', trackId] });
      const previousComments = queryClient.getQueryData(['comments', trackId]);

      queryClient.setQueryData(['comments', trackId], (old) => {
        if (!old) return old;
        return old.map(comment => {
          if (comment.id === commentId) {
            const tempReply = {
              id: `temp-${Date.now()}`,
              userId: user?.id || 'guest',
              displayName: user?.displayName || 'Guest User',
              username: user?.username || 'guest',
              avatarUrl: user?.avatarUrl || null,
              text: text,
              likes: 0,
              likedByCurrentUser: false,
              createdAt: 'Just now',
              replies: []
            };
            return {
              ...comment,
              replies: [...(comment.replies || []), tempReply]
            };
          }
          return comment;
        });
      });

      return { previousComments };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['comments', trackId], context.previousComments);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', trackId] });
    },
  });
}
