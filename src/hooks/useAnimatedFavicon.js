import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { getBaseTitle } from '../utils/pageTitle';

const PLAYING_FRAMES = [
  '/favicon-playing-1.svg',
  '/favicon-playing-2.svg',
  '/favicon-playing-3.svg'
];

export function useAnimatedFavicon() {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTrack = usePlayerStore((state) => state.currentTrack);

  useEffect(() => {
    let intervalId = null;
    const faviconLink = document.querySelector("link[rel*='icon']");

    if (isPlaying && currentTrack) {
      const artistName = currentTrack.artist?.user?.displayName || currentTrack.artist?.name || currentTrack.artist || 'NoirSound';
      document.title = `▶ ${currentTrack.title} • ${artistName}`;

      let frameIdx = 0;
      if (faviconLink) {
        faviconLink.setAttribute('href', PLAYING_FRAMES[0]);
      }

      intervalId = setInterval(() => {
        frameIdx = (frameIdx + 1) % PLAYING_FRAMES.length;
        if (faviconLink) {
          faviconLink.setAttribute('href', PLAYING_FRAMES[frameIdx]);
        }
      }, 350);
    } else {
      // Restore the page-owned title (SSR <head> or PageMeta) instead of
      // overwriting it with a hardcoded string.
      document.title = getBaseTitle();
      if (faviconLink && faviconLink.getAttribute('href') !== '/favicon.svg') {
        faviconLink.setAttribute('href', '/favicon.svg');
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, currentTrack]);
}
