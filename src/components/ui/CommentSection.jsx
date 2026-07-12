import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { useComments } from '../../hooks/queries/useComments';
import { usePostComment } from '../../hooks/mutations/usePostComment';
import { useUserStore } from '../../store/userStore';
import CommentItem from './CommentItem';
import FallbackAvatar from './FallbackAvatar';

export default function CommentSection({ trackId }) {
  const { t } = useTranslation();
  const { user, setAuthModalOpen } = useUserStore();

  const { data: trackComments = [], isLoading, error: commentsError } = useComments(trackId);
  const postCommentMutation = usePostComment(trackId);

  const [text, setText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!text.trim()) {
      setErrorMsg(t('comments.errorEmpty'));
      return;
    }
    if (text.trim().length > 200) {
      setErrorMsg(t('comments.errorTooLong'));
      return;
    }

    try {
      await postCommentMutation.mutateAsync(text.trim());
      setText('');
    } catch (err) {
      setErrorMsg(err.message || t('comments.postError'));
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="space-y-1 border-b border-zinc-800/70 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-brand-red" aria-hidden="true" />
          <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-zinc-300">
            {t('comments.title')}
          </h2>
          {trackComments.length > 0 && (
            <span className="text-xs font-mono text-zinc-500">({trackComments.length})</span>
          )}
        </div>
        <p className="text-xs text-zinc-500">{t('comments.subtitle')}</p>
      </div>

      {errorMsg && (
        <div id="comment-error" className="text-rose-300 text-sm font-semibold px-1" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Main comment input */}
      {!user ? (
        <div className="ns-state-panel !p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">{t('comments.signInPrompt')}</p>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="ns-button-secondary px-4 text-xs cursor-pointer shrink-0"
          >
            {t('comments.signIn')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800 bg-brand-dark shrink-0">
            <FallbackAvatar
              src={user.avatarUrl}
              name={user.displayName || user.username}
              className="w-full h-full text-[36px]"
              imageClassName="object-cover"
            />
          </div>
          <div className="flex-1 flex flex-col sm:flex-row gap-2.5 min-w-0">
            <label htmlFor={`comment-${trackId}`} className="sr-only">{t('comments.placeholder')}</label>
            <textarea
              id={`comment-${trackId}`}
              rows={2}
              maxLength={200}
              placeholder={t('comments.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="ns-field flex-1 px-4 py-3 text-sm resize-none placeholder-zinc-500"
              aria-invalid={Boolean(errorMsg)}
              aria-describedby={errorMsg ? 'comment-error' : undefined}
            />
            <button
              type="submit"
              disabled={!text.trim() || postCommentMutation.isPending}
              className="ns-button-primary px-5 min-h-11 flex items-center justify-center cursor-pointer shrink-0 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:shadow-none"
              aria-label={t('comments.post')}
            >
              {postCommentMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </form>
      )}

      {/* Comments list */}
      <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
        {commentsError ? (
          <div className="ns-state-panel ns-state-error !p-5 text-center text-sm text-rose-300" role="alert">
            {commentsError.message || t('comments.loadError')}
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={24} className="animate-spin text-zinc-500" />
          </div>
        ) : trackComments.length === 0 ? (
          <div className="ns-state-panel !p-6 text-center">
            <MessageSquare size={22} className="mx-auto text-zinc-600 mb-2" aria-hidden="true" />
            <p className="text-zinc-400 text-sm">{t('comments.empty')}</p>
          </div>
        ) : (
          trackComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} trackId={trackId} />
          ))
        )}
      </div>
    </div>
  );
}
