import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileHeader from './MobileHeader';
import LibraryDrawer from './LibraryDrawer';
import PlayerBar from '../player/PlayerBar';
import QueuePanel from '../player/QueuePanel';
import FullscreenLyricsPlayer from '../player/FullscreenLyricsPlayer';
import MobileNavbar from './MobileNavbar';
import Footer from './Footer';
import { usePlayerStore } from '../../store/playerStore';
import { useAnimatedFavicon } from '../../hooks/useAnimatedFavicon';

export default function AppLayout({ children }) {
  useAnimatedFavicon();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 1023px)').matches
  ));
  const { isPlayerCollapsed, currentTrack, lyricsFullscreenOpen } = usePlayerStore();
  const location = useLocation();
  const mainRef = useRef(null);
  const mobilePlayerIsModal = Boolean(
    isMobileViewport && currentTrack && !isPlayerCollapsed && !lyricsFullscreenOpen
  );
  const shellIsInert = lyricsFullscreenOpen || isQueueOpen || isDrawerOpen || mobilePlayerIsModal;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 1023px)');
    const updateViewport = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(query.matches);
    query.addEventListener?.('change', updateViewport);
    return () => query.removeEventListener?.('change', updateViewport);
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
    setIsQueueOpen(false);
    setIsDrawerOpen(false);
  }, [location.pathname]);

  // Keep page content clear of the exact visible player state.
  const paddingClass = isPlayerCollapsed
    ? currentTrack
      ? 'pb-[calc(var(--ns-mobile-nav-height)+var(--ns-mobile-player-height)+2rem)] lg:pb-8'
      : 'pb-[calc(var(--ns-mobile-nav-height)+2rem)] lg:pb-8'
    : 'pb-[calc(var(--ns-mobile-nav-height)+2rem)] lg:pb-[calc(var(--ns-player-height)+2rem)]';

  return (
    <>
      <div
        className="ns-app-background flex h-[100dvh] overflow-hidden font-sans text-zinc-100"
        aria-hidden={shellIsInert || undefined}
        inert={shellIsInert || undefined}
      >
      {/* Sidebar - Left Navigation for Desktop */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative">
        {/* Mobile sticky header */}
        <MobileHeader onOpenDrawer={() => setIsDrawerOpen(true)} />

        {/* Search, Notifications and Profile for Desktop */}
        <Header />
        
        {/* Scrollable page contents view */}
        <main ref={mainRef} className={`ns-main-scroll flex-1 overflow-y-auto overflow-x-hidden py-5 transition-[padding] duration-200 sm:py-6 ${paddingClass}`}>
          <div className="ns-page-container">
            {children}
            <Footer />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav menu */}
      <MobileNavbar />

      </div>
      <LibraryDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      {!lyricsFullscreenOpen && (
        <QueuePanel isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
      )}
      {!lyricsFullscreenOpen && (
        <PlayerBar onToggleQueue={() => setIsQueueOpen(!isQueueOpen)} isQueueOpen={isQueueOpen} />
      )}
      {lyricsFullscreenOpen && (
        <FullscreenLyricsPlayer
          isQueueOpen={isQueueOpen}
          onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
          onCloseQueue={() => setIsQueueOpen(false)}
        />
      )}
    </>
  );
}
