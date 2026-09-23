import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';

// Controls keep their native Space behavior; only the page background owns
// this shortcut. Mount once in the public shell, including fullscreen lyrics.
export default function usePlaybackKeyboard() {
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.code !== 'Space' && event.key !== ' ') || event.defaultPrevented
        || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
      const target = event.target;
      if (target?.isContentEditable || target?.closest?.(
        'input, textarea, select, button, a[href], summary, audio, video, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="textbox"], [role="combobox"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="tab"]'
      )) return;
      const player = usePlayerStore.getState();
      if (!player.currentTrack) return;
      event.preventDefault();
      if (!event.repeat) player.togglePlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
