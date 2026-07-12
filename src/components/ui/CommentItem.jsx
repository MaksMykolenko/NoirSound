import React, { useState } from 'react';
import { Heart, Reply, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteComment, postReply, setCommentLiked } from '../../api/comments';
import { useUserStore } from '../../store/userStore';
import ReplyThread from './ReplyThread';
import ReplyInput from './ReplyInput';
import FallbackAvatar from './FallbackAvatar';
import { formatNumber } from '../../utils/formatLocale';

export default function CommentItem({ comment, trackId }) {
  const { user } = useUserStore();
  const queryClient = useQueryClient();

  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const isLiked = comment.likedByCurrentUser;
  const isOwnComment = comment.userId === user?.id;

  const refreshComments = () => {
    queryClient.invalidateQueries({ queryKey: ['comments', trackId] });
  };

  const handleLike = async () => {
    if (!user) return;
    await setCommentLiked(comment.id, !isLiked);
    refreshComments();
  };

  const handleDelete = async () => {
    if (confirm("Delete this comment?")) {
      await deleteComment(comment.id);
      refreshComments();
    }
  };

  const handleReplySubmit = async (text) => {
    if (!user) return;
    await postReply(comment.id, text, user);
    refreshComments();
    setIsReplying(false);
    setShowReplies(true);
  };

  return (
    <article className="space-y-4 border-b border-zinc-800/60 pb-5 pt-1">
      
      {/* Comment Body */}
      <div className="flex gap-3">
        {/* Avatar */}
        <FallbackAvatar
          src={comment.avatarUrl}
          name={comment.displayName || comment.username}
          className="w-10 h-10 rounded-full border border-zinc-800 shrink-0 text-[36px]"
          imageClassName="object-cover"
        />

        {/* Text Area */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-col min-[430px]:flex-row min-[430px]:items-center justify-between gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] font-semibold text-zinc-200">{comment.displayName}</span>
              <span className="font-mono text-[10px] text-zinc-500">@{comment.username}</span>
            </div>
            <time className="font-mono text-[9px] text-zinc-500">{comment.createdAt}</time>
          </div>

          <p className="break-words text-[13px] leading-relaxed text-zinc-300">{comment.text}</p>

          {/* Actions Row */}
          <div className="flex items-center gap-2 pt-1.5 text-xs text-zinc-400 font-semibold">
            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex min-h-11 cursor-pointer items-center space-x-1 rounded px-2 transition-colors hover:text-rose-500 ${
                isLiked ? 'text-brand-red' : ''
              }`}
              aria-label={isLiked ? 'Unlike comment' : 'Like comment'}
              aria-pressed={isLiked}
            >
              <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} />
              <span>{formatNumber(comment.likes || 0)}</span>
            </button>

            {/* Reply */}
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="flex min-h-11 cursor-pointer items-center space-x-1 rounded px-2 transition-colors hover:text-zinc-200"
              aria-expanded={isReplying}
            >
              <Reply size={12} />
              <span>Reply</span>
            </button>

            {/* Delete */}
            {isOwnComment && (
              <button
                onClick={handleDelete}
                className="ml-auto flex min-h-11 cursor-pointer items-center space-x-1 rounded px-2 transition-colors hover:text-rose-500"
                title="Delete comment"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Reply input */}
      {isReplying && (
        <div className="pl-6 sm:pl-12">
          <ReplyInput
            username={comment.username}
            onSubmit={handleReplySubmit}
            onCancel={() => setIsReplying(false)}
          />
        </div>
      )}

      {/* Replies Thread */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-6 sm:pl-12 space-y-3">
          {/* Toggle button if there are replies */}
          <button
            onClick={() => setShowReplies(!showReplies)}
          className="min-h-11 px-2 flex items-center space-x-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer select-none rounded-lg"
          aria-expanded={showReplies}
          >
            {showReplies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>
              {showReplies ? 'Hide replies' : `View replies (${comment.replies.length})`}
            </span>
          </button>

          {showReplies && (
            <ReplyThread
              replies={comment.replies}
              commentId={comment.id}
              onLikeReply={async (replyId) => {
                const reply = comment.replies.find((item) => item.id === replyId);
                await setCommentLiked(replyId, !reply?.likedByCurrentUser);
                refreshComments();
              }}
              onDeleteReply={async (replyId) => {
                if (confirm("Delete this reply?")) {
                  await deleteComment(replyId);
                  refreshComments();
                }
              }}
            />
          )}
        </div>
      )}

    </article>
  );
}
