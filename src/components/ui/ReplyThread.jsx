import React from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import FallbackAvatar from './FallbackAvatar';
import { formatNumber } from '../../utils/formatLocale';

export default function ReplyThread({ replies, onLikeReply, onDeleteReply }) {
  const { user } = useUserStore();

  return (
    <div className="space-y-4 border-l-2 border-brand-red/20 pl-3 sm:pl-4 mt-2">
      {replies.map((reply) => {
        const isLiked = reply.likedByCurrentUser;
        const isOwnReply = reply.userId === user?.id;

        return (
          <div key={reply.id} className="group/reply flex gap-2.5">
            {/* Small Avatar */}
            <FallbackAvatar
              src={reply.avatarUrl}
              name={reply.displayName || reply.username}
              className="w-7 h-7 rounded-full border border-zinc-800 shrink-0 mt-0.5 text-[24px]"
              imageClassName="object-cover"
            />

            {/* Content Area */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-col min-[430px]:flex-row min-[430px]:items-center justify-between gap-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-[12px] font-semibold text-zinc-200">{reply.displayName}</span>
                  <span className="font-mono text-[9px] text-zinc-500">@{reply.username}</span>
                </div>
                <time className="font-mono text-[9px] text-zinc-500">{reply.createdAt}</time>
              </div>

              <p className="break-words text-[13px] leading-relaxed text-zinc-300">{reply.text}</p>

              {/* Actions row */}
              <div className="flex items-center space-x-3.5 pt-1 text-[12px] text-zinc-400 font-bold">
                {/* Like */}
                <button
                  onClick={() => onLikeReply(reply.id)}
                  className={`flex min-h-10 cursor-pointer items-center space-x-1 rounded px-2 transition-colors hover:text-rose-500 ${
                    isLiked ? 'text-brand-red' : ''
                  }`}
                  aria-label={isLiked ? 'Unlike reply' : 'Like reply'}
                  aria-pressed={isLiked}
                >
                  <Heart size={10} fill={isLiked ? 'currentColor' : 'none'} />
                  <span>{formatNumber(reply.likes || 0)}</span>
                </button>

                {/* Delete */}
                {isOwnReply && (
                  <button
                    onClick={() => onDeleteReply(reply.id)}
                    className="ml-auto flex min-h-10 cursor-pointer items-center space-x-1 rounded px-2 transition-colors hover:text-rose-500 md:opacity-0 md:group-hover/reply:opacity-100"
                    title="Delete reply"
                  >
                    <Trash2 size={10} />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
