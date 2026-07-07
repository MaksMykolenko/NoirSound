import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const EDGE_GAP = 10;

function nextEnabledIndex(items, start, direction) {
  if (!items.length) return -1;
  let index = start;
  for (let count = 0; count < items.length; count += 1) {
    index = (index + direction + items.length) % items.length;
    if (items[index]?.type !== 'separator' && !items[index]?.disabled) return index;
  }
  return -1;
}

export default function ContextMenu({
  items,
  anchor,
  onClose,
  onActionStateChange,
  invoker,
}) {
  const { t } = useTranslation();
  const menuRef = useRef(null);
  const itemRefs = useRef([]);
  const [position, setPosition] = useState(anchor);
  const [activeIndex, setActiveIndex] = useState(() => nextEnabledIndex(items, -1, 1));
  const [pendingId, setPendingId] = useState(null);
  const isMobile = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 640px)').matches;

  useLayoutEffect(() => {
    if (isMobile || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    setPosition({
      x: Math.max(EDGE_GAP, Math.min(anchor.x, window.innerWidth - rect.width - EDGE_GAP)),
      y: Math.max(EDGE_GAP, Math.min(anchor.y, window.innerHeight - rect.height - EDGE_GAP)),
    });
  }, [anchor.x, anchor.y, isMobile, items.length]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) onClose();
    };
    const handleResize = () => onClose();
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [onClose]);

  const closeAndRestoreFocus = () => {
    onClose();
    window.requestAnimationFrame(() => invoker?.focus?.());
  };

  useEffect(() => {
    const closeFirstOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onClose();
      window.requestAnimationFrame(() => invoker?.focus?.());
    };
    window.addEventListener('keydown', closeFirstOnEscape, true);
    return () => window.removeEventListener('keydown', closeFirstOnEscape, true);
  }, [invoker, onClose]);

  const runItem = async (item) => {
    if (!item || item.disabled || item.type === 'separator' || pendingId) return;
    try {
      const result = item.onSelect?.();
      if (result && typeof result.then === 'function') {
        setPendingId(item.id);
        onActionStateChange?.(item.id);
        await result;
      }
      closeAndRestoreFocus();
    } catch {
      // The API layer owns visible error reporting. Keep the menu usable.
      setPendingId(null);
      onActionStateChange?.(null);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => nextEnabledIndex(items, current, direction));
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home'
        ? nextEnabledIndex(items, -1, 1)
        : nextEnabledIndex(items, 0, -1));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      runItem(items[activeIndex]);
    }
  };

  const menu = (
    <>
      {isMobile && (
        <button
          type="button"
          aria-label={t('contextMenu.closeActions')}
          className="fixed inset-0 z-[225] bg-black/55 backdrop-blur-[2px]"
          onClick={closeAndRestoreFocus}
        />
      )}
      <div
        ref={menuRef}
        role="menu"
        aria-label={t('contextMenu.actions')}
        onKeyDown={handleKeyDown}
        className={`fixed z-[230] overflow-hidden border border-zinc-700/80 bg-zinc-950/98 shadow-[0_22px_65px_rgba(0,0,0,.68)] backdrop-blur-xl ${
          isMobile
            ? 'inset-x-2 bottom-2 max-h-[72vh] overflow-y-auto rounded-3xl p-2 pb-[max(.5rem,env(safe-area-inset-bottom))]'
            : 'w-64 rounded-2xl p-1.5'
        }`}
        style={isMobile ? undefined : { left: position.x, top: position.y }}
      >
        {isMobile && <div className="mx-auto mb-2 mt-1 h-1 w-10 rounded-full bg-zinc-700" />}
        {items.map((item, index) => {
          if (item.type === 'separator') {
            return <div key={item.id || `separator-${index}`} role="separator" className="my-1 border-t border-zinc-800" />;
          }
          const Icon = item.icon;
          const pending = pendingId === item.id;
          return (
            <button
              key={item.id}
              ref={(node) => { itemRefs.current[index] = node; }}
              type="button"
              role="menuitem"
              tabIndex={index === activeIndex ? 0 : -1}
              disabled={item.disabled || Boolean(pendingId)}
              aria-disabled={item.disabled || undefined}
              onFocus={() => setActiveIndex(index)}
              onClick={() => runItem(item)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-brand-red/70 ${
                item.danger
                  ? 'text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10'
                  : 'text-zinc-200 hover:bg-zinc-800/80 focus:bg-zinc-800/80'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {pending
                ? <LoaderCircle size={16} className="animate-spin shrink-0" />
                : Icon
                  ? <Icon size={16} className="shrink-0" />
                  : <span className="w-4" />}
              <span className="min-w-0 flex-1 truncate">{pending ? (item.pendingLabel || item.label) : item.label}</span>
              {item.checked && <Check size={15} className="text-brand-red shrink-0" aria-hidden="true" />}
              {item.hint && <span className="text-[10px] font-medium text-zinc-500">{item.hint}</span>}
            </button>
          );
        })}
      </div>
    </>
  );

  return typeof document === 'undefined' ? null : createPortal(menu, document.body);
}
