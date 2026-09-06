import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { usePlayerStore } from '../../store/playerStore';
import { usePublicPlayback } from './publicPlaybackContext';

export default function LandingLayout() {
  useEffect(() => {
    // App overflow-x:hidden creates a body scroll container and prevents native
    // sticky scenes from following the viewport. This route-only class uses
    // clip instead; removing the layout restores the ordinary app cascade.
    const elements = [document.documentElement, document.body];
    const added = elements.filter(element => !element.classList.contains('ns-landing-document'));
    added.forEach(element => element.classList.add('ns-landing-document'));
    return () => added.forEach(element => element.classList.remove('ns-landing-document'));
  }, []);
  const { shellIsInert, isMobileViewport } = usePublicPlayback();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlayerCollapsed = usePlayerStore((state) => state.isPlayerCollapsed);
  const playerSpace = !currentTrack
    ? undefined
    : isMobileViewport
      ? 'calc(var(--ns-mobile-player-height) + var(--ns-safe-area-bottom) + 2rem)'
      : isPlayerCollapsed ? '6rem' : 'calc(var(--ns-player-height) + 2rem)';

  return (
    <div
      aria-hidden={shellIsInert || undefined}
      inert={shellIsInert || undefined}
      style={{ background: '#000', paddingBottom: playerSpace }}
    >
      <Outlet />
    </div>
  );
}
