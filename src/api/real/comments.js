import { apiFetch } from '../client';

function mapCommentResponse(comment) {
  if (!comment) return null;
  return {
    id: comment.id,
    trackId: comment.trackId,
    userId: comment.userId,
    displayName: comment.user?.displayName || comment.user?.username || 'Unknown user',
    username: comment.user?.username || 'unknown',
    avatarUrl: comment.user?.avatarUrl || null,
    text: comment.isDeleted ? '[Deleted]' : comment.text,
    likes: comment.likes || 0,
    likedByCurrentUser: Boolean(comment.likedByCurrentUser),
    createdAt: comment.createdAt
      ? new Date(comment.createdAt).toLocaleDateString()
      : '',
    isDeleted: Boolean(comment.isDeleted),
    replies: Array.isArray(comment.replies)
      ? comment.replies.map(mapCommentResponse).filter(Boolean)
      : [],
  };
}

export async function getCommentsForTrack(trackId) {
  const response = await apiFetch(`/tracks/${trackId}/comments`);
  const data = response?.data ?? response;
  if (!Array.isArray(data)) return [];
  return data.map(mapCommentResponse).filter(Boolean);
}

export async function postComment(trackId, text) {
  const response = await apiFetch(`/tracks/${trackId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return mapCommentResponse(response.comment ?? response);
}

export async function postReply(commentId, text) {
  const response = await apiFetch(`/comments/${commentId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return mapCommentResponse(response.reply ?? response);
}

export async function setCommentLiked(commentId, liked) {
  return apiFetch(`/comments/${commentId}/like`, {
    method: liked ? 'POST' : 'DELETE',
  });
}

export async function deleteComment(commentId) {
  return apiFetch(`/comments/${commentId}`, { method: 'DELETE' });
}
