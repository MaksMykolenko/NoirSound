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
  const { isPlayerCollapsed, currentTrack, lyricsFullscreenOpen } = usePlayerStore();
  const location = useLocation();
  const mainRef = useRef(null);


  useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
    setIsQueueOpen(false);
    setIsDrawerOpen(false);
  }, [location.pathname]);

  // Keep page content clear of the exact visible player state.
  const paddingClass = currentTrack
    ? isPlayerCollapsed
      ? 'pb-44 sm:pb-36 lg:pb-8' // mobile nav + mini-player clearance
      : 'pb-32 sm:pb-28 lg:pb-28' // mobile sheet overlay clearance
    : isPlayerCollapsed
      ? 'pb-32 sm:pb-28 lg:pb-8' // mobile nav clearance
      : 'pb-32 sm:pb-28 lg:pb-16'; // compact empty desktop player clearance

  return (
    <>
      <div
        className="flex h-[100dvh] overflow-hidden bg-brand-dark text-zinc-100 font-sans ns-app-background"
        aria-hidden={lyricsFullscreenOpen || undefined}
        inert={lyricsFullscreenOpen || undefined}
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
        <main ref={mainRef} className={`flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-5 sm:py-7 transition-all duration-300 ${paddingClass}`}>
          <div className="max-w-7xl mx-auto w-full">
            {children}
            <Footer />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav menu */}
      <MobileNavbar />

      {/* Mobile Library Drawer overlay */}
      <LibraryDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {/* Slide-out Music Queue panel */}
      {!lyricsFullscreenOpen && (
        <QueuePanel isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
      )}

      {/* Sticky Bottom Music Player */}
      <PlayerBar onToggleQueue={() => setIsQueueOpen(!isQueueOpen)} isQueueOpen={isQueueOpen} />
      </div>
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
