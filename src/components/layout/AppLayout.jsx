import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileHeader from './MobileHeader';
import LibraryDrawer from './LibraryDrawer';
import MobileNavbar from './MobileNavbar';
import Footer from './Footer';
import { usePlayerStore } from '../../store/playerStore';
import { usePublicPlayback } from './publicPlaybackContext';

export default function AppLayout({ children }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isPlayerCollapsed = usePlayerStore((state) => state.isPlayerCollapsed);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const { shellIsInert: playbackIsInert } = usePublicPlayback();
  const location = useLocation();
  const mainRef = useRef(null);
  const shellIsInert = playbackIsInert || isDrawerOpen;

  useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
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
        <main ref={mainRef} className={`ns-main-scroll flex-1 overflow-y-auto overflow-x-hidden transition-[padding] duration-200 ${paddingClass}`}>
          <div className="ns-page-container pt-5 sm:pt-6">
            {children ?? <Outlet />}
            <Footer />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav menu */}
      <MobileNavbar />

      </div>
      <LibraryDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}
