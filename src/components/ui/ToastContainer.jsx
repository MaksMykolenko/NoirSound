import React from 'react';
import { useToastStore } from '../../store/toastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-36 right-3 left-3 sm:left-auto z-[100] flex flex-col space-y-2 pointer-events-none sm:bottom-6 sm:right-6" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto w-full sm:w-[340px] flex items-start space-x-3 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.8)] glass-panel animate-fade-in"
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-brand-red" />}
            {toast.type === 'info' && <Info size={18} className="text-zinc-400" />}
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-zinc-200">{toast.message}</p>
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
