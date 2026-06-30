import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorState({
  title = 'Something went wrong',
  message = 'This part of NoirSound could not be loaded.',
  onRetry
}) {
  return (
    <div className="ns-state-panel ns-state-error !p-6 sm:!p-8 max-w-xl mx-auto text-center" role="alert">
      <div className="w-11 h-11 mx-auto mb-3 rounded-2xl bg-rose-500/10 border border-rose-400/20 text-rose-300 flex items-center justify-center">
        <AlertTriangle size={20} />
      </div>
      <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
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
