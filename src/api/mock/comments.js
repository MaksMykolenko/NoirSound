import { mockComments } from './data';

export async function getCommentsForTrack(trackId) {
  return mockComments.filter((comment) => comment.trackId === trackId);
}

function createDemoComment(trackId, text, user) {
  return {
    id: `demo-comment-${Date.now()}`,
    trackId,
    userId: user?.id || 'demo-guest',
    displayName: user?.displayName || 'Demo Guest',
    username: user?.username || 'demo_guest',
    avatarUrl: user?.avatarUrl || null,
    text,
    likes: 0,
    likedByCurrentUser: false,
    createdAt: 'Just now',
    replies: [],
  };
}

export async function postComment(trackId, text, user) {
  return createDemoComment(trackId, text, user);
}

export async function postReply(_commentId, text, user) {
  return createDemoComment(null, text, user);
}

export async function setCommentLiked() {
  return { success: true };
}

export async function deleteComment() {
  return { success: true };
}
