import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ContextMenuProvider from '../context-menu/ContextMenuProvider';
import PlayerBar from '../player/PlayerBar';
import QueuePanel from '../player/QueuePanel';
import FullscreenLyricsPlayer from '../player/FullscreenLyricsPlayer';
import { usePlayerStore } from '../../store/playerStore';
import { useAnimatedFavicon } from '../../hooks/useAnimatedFavicon';
import { PublicPlaybackContext } from './publicPlaybackContext';

// This parent route stays mounted when switching between landing and app chrome.
// Playback remains owned by the existing store singleton, including its listeners.
export default function PublicAppShell({ children }) {
  useAnimatedFavicon();
  const { t } = useTranslation();
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 1023px)').matches
  ));
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlayerCollapsed = usePlayerStore((state) => state.isPlayerCollapsed);
  const lyricsFullscreenOpen = usePlayerStore((state) => state.lyricsFullscreenOpen);
  const mobilePlayerIsModal = Boolean(
    isMobileViewport && currentTrack && !isPlayerCollapsed && !lyricsFullscreenOpen
  );
  const shellIsInert = lyricsFullscreenOpen || isQueueOpen || mobilePlayerIsModal;
  const playbackContext = useMemo(() => ({ shellIsInert, isMobileViewport }), [shellIsInert, isMobileViewport]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 1023px)');
    const updateViewport = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(query.matches);
    query.addEventListener?.('change', updateViewport);
    return () => query.removeEventListener?.('change', updateViewport);
  }, []);

  useEffect(() => {
    setIsQueueOpen(false);
  }, [location.pathname]);

  return (
    <ContextMenuProvider>
      <PublicPlaybackContext.Provider value={playbackContext}>
        <Suspense fallback={<div role="status" aria-label={t('loadingPage')}>{t('loadingPage')}</div>}>
          {children ?? <Outlet />}
        </Suspense>
        {/* Scope only placement here; landing styling never reaches shared controls. */}
        <div style={isLanding ? { '--ns-mobile-nav-height': 'var(--ns-safe-area-bottom)' } : undefined}>
          {!lyricsFullscreenOpen && (
            <QueuePanel isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
          )}
          {!lyricsFullscreenOpen && (!isLanding || currentTrack) && (
            <PlayerBar onToggleQueue={() => setIsQueueOpen((open) => !open)} isQueueOpen={isQueueOpen} />
          )}
          {lyricsFullscreenOpen && (
            <FullscreenLyricsPlayer
              isQueueOpen={isQueueOpen}
              onToggleQueue={() => setIsQueueOpen((open) => !open)}
              onCloseQueue={() => setIsQueueOpen(false)}
            />
          )}
        </div>
      </PublicPlaybackContext.Provider>
    </ContextMenuProvider>
  );
}
