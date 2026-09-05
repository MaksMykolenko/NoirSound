import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useToastStore } from '../../store/toastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ToastContainer() {
  const { t } = useTranslation();
  const location = useLocation();
  const { toasts, removeToast } = useToastStore();
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const [playerLayout, setPlayerLayout] = useState({
    isPlayerCollapsed: false,
    lyricsFullscreenOpen: false,
  });

  useEffect(() => {
    if (isAdminRoute) return undefined;

    let active = true;
    let unsubscribe;
    import('../../store/playerStore').then(({ usePlayerStore }) => {
      if (!active) return;
      const update = (state) => setPlayerLayout({
        isPlayerCollapsed: state.isPlayerCollapsed,
        lyricsFullscreenOpen: state.lyricsFullscreenOpen,
      });
      update(usePlayerStore.getState());
      unsubscribe = usePlayerStore.subscribe(update);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [isAdminRoute]);

  const bottomClass = isAdminRoute
    ? 'bottom-6'
    : playerLayout.lyricsFullscreenOpen
    ? 'bottom-[calc(var(--ns-fullscreen-mobile-controls-height)+1rem)] lg:bottom-[calc(var(--ns-player-height)+1rem)]'
    : `bottom-[calc(var(--ns-mobile-nav-height)+var(--ns-mobile-player-height)+1rem)] ${playerLayout.isPlayerCollapsed ? 'lg:bottom-6' : 'lg:bottom-[calc(var(--ns-player-height)+1rem)]'}`;

  return (
    <div className={`pointer-events-none fixed left-3 right-3 z-[var(--ns-z-toast)] flex flex-col space-y-2 sm:left-auto sm:right-6 ${bottomClass}`} aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-none flex w-full animate-fade-in items-start gap-3 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] p-3 shadow-lg sm:w-[340px]"
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-brand-red" />}
            {toast.type === 'info' && <Info size={18} className="text-zinc-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium text-zinc-200">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="pointer-events-auto shrink-0 ns-media-action text-zinc-500"
            aria-label={t('actions.close')}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
