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
          <div key={reply.id} className="flex gap-2.5 group/reply animate-fade-in">
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
                  <span className="text-[13px] font-bold text-zinc-200">{reply.displayName}</span>
                  <span className="text-[11.5px] text-zinc-400 font-semibold">@{reply.username}</span>
                </div>
                <time className="text-xs text-zinc-400 font-semibold">{reply.createdAt}</time>
              </div>

              <p className="text-[13.5px] text-zinc-300 leading-relaxed break-words">{reply.text}</p>

              {/* Actions row */}
              <div className="flex items-center space-x-3.5 pt-1 text-[12px] text-zinc-400 font-bold">
                {/* Like */}
                <button
                  onClick={() => onLikeReply(reply.id)}
                  className={`min-h-10 px-2 flex items-center space-x-1 hover:text-rose-500 transition-colors cursor-pointer rounded-lg ${
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
                    className="min-h-10 px-2 flex items-center space-x-1 hover:text-rose-500 transition-colors md:opacity-0 md:group-hover/reply:opacity-100 transition-opacity cursor-pointer ml-auto rounded-lg"
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
