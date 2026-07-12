import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorState({
  title = 'Something went wrong',
  message = 'This part of NoirSound could not be loaded.',
  onRetry
}) {
  return (
    <div className="ns-state-panel ns-state-error mx-auto max-w-xl !p-6 text-center" role="alert">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-rose-400/20 bg-rose-500/10 text-rose-300">
        <AlertTriangle size={20} />
      </div>
      <h2 className="text-base font-semibold tracking-tight text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ns-button-secondary mt-5 px-5 inline-flex items-center justify-center gap-2 text-sm"
        >
          <RotateCcw size={15} />
          Try again
        </button>
      )}
    </div>
  );
}
