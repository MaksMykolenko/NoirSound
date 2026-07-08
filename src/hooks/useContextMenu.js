import { useCallback, useMemo } from 'react';
import { useContextMenuController } from '../components/context-menu/contextMenuController';

const NATIVE_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="textbox"]',
].join(',');

export function shouldKeepNativeContextMenu(target) {
  if (!(target instanceof Element)) return false;
  const closest = target.closest(NATIVE_TARGET_SELECTOR);
  console.log('[context-menu-debug] closest native:', closest ? closest.tagName : null);
  if (closest) return true;
  const selection = window.getSelection?.();
  const selectedText = selection && !selection.isCollapsed && selection.toString().trim();
  console.log('[context-menu-debug] selectedText:', selectedText);
  return Boolean(selectedText);
}

export default function useContextMenu(itemsOrFactory, dependencies = []) {
  const controller = useContextMenuController();
  const items = useMemo(
    () => (typeof itemsOrFactory === 'function' ? itemsOrFactory() : itemsOrFactory),
    // The call sites explicitly own dependency correctness, like useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dependencies
  );

  const openAt = useCallback((eventOrPoint, invoker) => {
    const isEvent = typeof eventOrPoint?.preventDefault === 'function';
    const target = isEvent ? eventOrPoint.target : invoker;
    console.log('[context-menu-debug] openAt target:', target ? { tagName: target.tagName, className: target.className, role: target.getAttribute?.('role') } : null);
    const keepNative = isEvent && shouldKeepNativeContextMenu(target);
    console.log('[context-menu-debug] keepNative:', keepNative);
    console.log('[context-menu-debug] items:', items ? items.length : null);
    if (keepNative) return false;
    if (isEvent) {
      eventOrPoint.preventDefault();
      eventOrPoint.stopPropagation();
    }
    const point = isEvent
      ? { x: eventOrPoint.clientX, y: eventOrPoint.clientY }
      : eventOrPoint;
    controller.openContextMenu(items, point, invoker || (isEvent ? eventOrPoint.currentTarget : null));
    return true;
  }, [controller, items]);

  const onContextMenu = useCallback((event) => openAt(event, event.currentTarget), [openAt]);

  const onKeyDown = useCallback((event) => {
    const opensMenu = (event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu';
    if (!opensMenu) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    controller.openContextMenu(items, {
      x: rect.left + Math.min(32, rect.width / 2),
      y: rect.top + Math.min(32, rect.height / 2),
    }, event.currentTarget);
  }, [controller, items]);

  const openFromButton = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    controller.openContextMenu(items, { x: rect.right, y: rect.bottom + 4 }, event.currentTarget);
  }, [controller, items]);

  return {
    contextMenuProps: { onContextMenu, onKeyDown },
    openFromButton,
    openAt,
  };
}
