import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let scrollLocks = 0;
let previousOverflow = '';
let previousOverscroll = '';

export function isVisibleOverlayElement(element) {
  if (!element?.isConnected) return false;
  for (let current = element; current instanceof Element; current = current.parentElement) {
    if (current.hidden || current.inert || current.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

export function getOverlayLayer(element) {
  let layer = 0;
  for (let current = element; current instanceof Element; current = current.parentElement) {
    const value = Number.parseInt(window.getComputedStyle(current).zIndex, 10);
    if (Number.isFinite(value)) layer = Math.max(layer, value);
  }
  return layer;
}

// Read mounted, visible surfaces instead of remembering stale menu state.
// Later siblings win at an equal layer, matching the normal paint order.
export function isTopmostOverlay(element) {
  if (!isVisibleOverlayElement(element)) return false;
  const overlays = [...document.querySelectorAll(
    '[role="dialog"][aria-modal="true"], [role="alertdialog"], [role="menu"], [data-ns-overlay]'
  )].filter(isVisibleOverlayElement);
  let top = null;
  let highestLayer = -1;
  for (const overlay of overlays) {
    const layer = getOverlayLayer(overlay);
    if (layer >= highestLayer) {
      highestLayer = layer;
      top = overlay;
    }
  }
  return !top || top === element;
}

function lockBodyScroll() {
  if (scrollLocks === 0) {
    previousOverflow = document.body.style.overflow;
    previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
  }
  scrollLocks += 1;
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    }
  };
}

export default function useDialogFocusTrap(isOpen, onClose, { lockScroll = true } = {}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const wasOpenRef = useRef(false);
  const openerRef = useRef(null);
  closeRef.current = onClose;
  // Capture before React commits: the opener may be unmounted by the same
  // update, and React autoFocus may move focus before this effect runs.
  if (isOpen && !wasOpenRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement;
  }
  wasOpenRef.current = isOpen;

  useEffect(() => {
    if (!isOpen) return undefined;
    const mountedDialog = dialogRef.current;
    const opener = openerRef.current;
    const openerId = opener?.id;
    const openerLabel = opener?.getAttribute?.('aria-label');
    const unlockScroll = lockScroll ? lockBodyScroll() : () => {};
    const focusableElements = () => [...(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])]
      .filter((element) => element.tabIndex >= 0 && isVisibleOverlayElement(element));
    const focusDialog = () => {
      if (!dialogRef.current) return;
      dialogRef.current.tabIndex = -1;
      dialogRef.current.focus();
    };
    const focusInitial = () => {
      if (!isTopmostOverlay(dialogRef.current)) return;
      const focusable = focusableElements();
      const preferred = focusable.find((element) => element.hasAttribute('autofocus'));
      const alreadyFocused = focusable.includes(document.activeElement) ? document.activeElement : null;
      if (preferred || alreadyFocused || focusable[0]) (preferred || alreadyFocused || focusable[0]).focus();
      else focusDialog();
    };
    focusInitial();
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' && event.key !== 'Tab') return;
      if (event.defaultPrevented || !isTopmostOverlay(dialogRef.current)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        focusDialog();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focusIsOutside = !dialogRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || focusIsOutside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || focusIsOutside)) {
        event.preventDefault();
        first.focus();
      }
    };
    // Bubble after a nested menu/listbox has had a chance to consume Escape.
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
      // StrictMode replays effects while this dialog remains mounted. That
      // cleanup must not restore a stale opener over the newly focused control.
      if (isVisibleOverlayElement(mountedDialog)) return;
      const restoreFocus = () => {
        const replacement = openerId
          ? document.getElementById(openerId)
          : openerLabel
            ? [...document.querySelectorAll('[aria-label]')].find((element) => (
              element.getAttribute('aria-label') === openerLabel && isVisibleOverlayElement(element)
            ))
            : null;
        const target = isVisibleOverlayElement(opener) ? opener : replacement;
        if (!isVisibleOverlayElement(target)) return false;
        target.focus?.();
        return document.activeElement === target;
      };
      if (!restoreFocus()) {
        window.requestAnimationFrame(() => {
          // A newly opened overlay may already own focus after this one left.
          if (document.activeElement === document.body) restoreFocus();
        });
      }
    };
  }, [isOpen, lockScroll]);

  return dialogRef;
}
