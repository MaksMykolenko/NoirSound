import React from 'react';
import { useToastStore } from '../../store/toastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="pointer-events-none fixed bottom-36 left-3 right-3 z-[var(--ns-z-toast)] flex flex-col space-y-2 sm:bottom-6 sm:left-auto sm:right-6" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex w-full animate-fade-in items-start gap-3 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] p-4 shadow-2xl sm:w-[340px]"
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-brand-red" />}
            {toast.type === 'info' && <Info size={18} className="text-zinc-400" />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-zinc-200">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 ns-icon-button !min-h-9 !min-w-9 text-zinc-500"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
