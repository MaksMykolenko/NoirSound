import React, { useState } from 'react';
import { X, CornerDownRight } from 'lucide-react';

export default function ReplyInput({ username, onSubmit, onCancel }) {
  const [text, setText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!text.trim()) {
      setErrorMsg('Reply cannot be empty.');
      return;
    }
    if (text.trim().length > 200) {
      setErrorMsg('Reply cannot exceed 200 characters.');
      return;
    }
    try {
      setIsSubmitting(true);
      await onSubmit(text.trim());
      setText('');
    } catch (error) {
      setErrorMsg(error.message || 'Reply could not be posted.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2.5 rounded-md border border-zinc-800 bg-zinc-950/80 p-3"
    >
      <div className="flex justify-between items-center text-xs text-zinc-400 font-semibold px-0.5">
        <span className="flex items-center space-x-1">
          <CornerDownRight size={10} className="text-brand-red" />
          <span>Replying to <span className="text-brand-red">@{username}</span></span>
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-10 cursor-pointer items-center space-x-1 rounded px-2 text-zinc-500 hover:text-zinc-300"
        >
          <X size={10} />
          <span>Cancel</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 space-y-1">
          {errorMsg && (
            <div id="reply-error" className="text-rose-300 text-xs font-semibold px-1" role="alert">
              {errorMsg}
            </div>
          )}
          <label htmlFor={`reply-${username}`} className="sr-only">Write a reply to {username}</label>
          <textarea
            id={`reply-${username}`}
            rows={2}
            maxLength={200}
            placeholder="Write a reply..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="ns-field w-full px-3 py-2.5 text-sm resize-none placeholder-zinc-500"
            aria-invalid={Boolean(errorMsg)}
            aria-describedby={errorMsg ? 'reply-error' : undefined}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={!text.trim() || isSubmitting}
          className="ns-button-primary px-4 disabled:bg-zinc-800 disabled:text-zinc-600 text-xs cursor-pointer shrink-0"
        >
          {isSubmitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}
