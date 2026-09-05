import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useDialogFocusTrap, { isTopmostOverlay } from '../../hooks/useDialogFocusTrap';

const EDGE_GAP = 10;
const MOBILE_QUERY = '(max-width: 639px)';

function optionIndex(options, value) {
  const index = options.findIndex((option) => option.value === value && !option.disabled);
  return index >= 0 ? index : options.findIndex((option) => !option.disabled);
}

function nextEnabledIndex(options, start, direction) {
  if (!options.length) return -1;
  let index = start;
  for (let count = 0; count < options.length; count += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

export default function DiscoverFilterDropdown({
  id,
  label,
  value = '',
  options = [],
  onChange,
  align = 'start',
  testId,
}) {
  const { t } = useTranslation();
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const restoreFocusOnCloseRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => optionIndex(options, value));
  const [position, setPosition] = useState({ left: EDGE_GAP, top: EDGE_GAP, width: 240 });
  const isMobile = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(MOBILE_QUERY).matches;

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label || label;
  const selectedValue = Boolean(value);

  const close = ({ restore = true } = {}) => {
    restoreFocusOnCloseRef.current = restore;
    setOpen(false);
  };

  const panelRef = useDialogFocusTrap(open && isMobile, () => close());

  const openWithIndex = (index = optionIndex(options, value)) => {
    setActiveIndex(index);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || isMobile || !triggerRef.current || !panelRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const width = Math.max(triggerRect.width, Math.min(280, panelRect.width));
    const leftCandidate = align === 'end' ? triggerRect.right - width : triggerRect.left;
    const left = Math.max(EDGE_GAP, Math.min(leftCandidate, window.innerWidth - width - EDGE_GAP));
    const belowTop = triggerRect.bottom + 8;
    const aboveTop = triggerRect.top - panelRect.height - 8;
    const hasRoomBelow = belowTop + panelRect.height <= window.innerHeight - EDGE_GAP;
    const top = hasRoomBelow
      ? belowTop
      : Math.max(EDGE_GAP, Math.min(aboveTop, window.innerHeight - panelRect.height - EDGE_GAP));
    setPosition({ left, top, width });
  }, [align, isMobile, open, options.length, panelRef]);

  useEffect(() => {
    if (!open) return undefined;
    optionRefs.current[activeIndex]?.focus();

    const onPointerDown = (event) => {
      if (panelRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      close();
    };
    const onEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !isTopmostOverlay(panelRef.current)) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const onViewportChange = (event) => {
      if (event.type === 'scroll' && (isMobile || panelRef.current?.contains(event.target))) return;
      close({ restore: false });
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onEscape, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onEscape, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [activeIndex, open, isMobile, panelRef]);

  useEffect(() => {
    if (!open) setActiveIndex(optionIndex(options, value));
  }, [open, options, value]);

  useLayoutEffect(() => {
    if (open || !restoreFocusOnCloseRef.current) return;
    restoreFocusOnCloseRef.current = false;
    triggerRef.current?.focus();
  }, [open, value]);

  const selectOption = (option) => {
    if (!option || option.disabled) return;
    onChange?.(option.value);
    close();
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const start = optionIndex(options, value);
      openWithIndex(event.key === 'ArrowDown'
        ? start
        : nextEnabledIndex(options, start < 0 ? 0 : start, -1));
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  };

  const handlePanelKeyDown = (event) => {
    if (event.key === 'Tab') {
      if (isMobile) return;
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => nextEnabledIndex(
        options,
        current,
        event.key === 'ArrowDown' ? 1 : -1,
      ));
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home'
        ? nextEnabledIndex(options, -1, 1)
        : nextEnabledIndex(options, 0, -1));
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('[role="option"]')) {
      event.preventDefault();
      selectOption(options[activeIndex]);
    }
  };

  const panel = open ? (
    <>
      {isMobile && (
        <button
          type="button"
          className="fixed inset-0 z-[var(--ns-z-context-overlay)] bg-black/60"
          aria-label={t('actions.close')}
          onClick={() => close()}
        />
      )}
      <div
        ref={panelRef}
        role={isMobile ? 'dialog' : undefined}
        aria-modal={isMobile ? 'true' : undefined}
        data-ns-overlay="discover-filter"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        data-testid={testId ? `${testId}-panel` : undefined}
        className={`fixed z-[var(--ns-z-context-menu)] overflow-y-auto border border-[var(--ns-border-strong)] bg-[var(--ns-card-solid)] shadow-2xl ${
          isMobile
            ? 'inset-x-0 bottom-0 max-h-[72dvh] rounded-t-lg p-2 pb-[max(.5rem,env(safe-area-inset-bottom))]'
            : 'max-h-[min(22rem,calc(100dvh-20px))] rounded-lg p-1.5'
        }`}
        style={isMobile ? undefined : position}
      >
        {isMobile && (
          <div className="mb-2 flex min-h-11 items-center justify-between border-b border-zinc-800/70 px-2 pb-2">
            <span className="text-sm font-semibold text-zinc-200">{label}</span>
            <button
              type="button"
              className="ns-icon-button !min-h-11 !min-w-11"
              aria-label={t('actions.close')}
              onClick={() => close()}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div id={`${id}-listbox`} role="listbox" aria-label={label}>
        {options.map((option, index) => {
          const active = option.value === value;
          return (
            <button
              key={`${id}-${option.value || 'all'}`}
              ref={(node) => { optionRefs.current[index] = node; }}
              type="button"
              role="option"
              tabIndex={index === activeIndex ? 0 : -1}
              aria-selected={active}
              disabled={option.disabled}
              onFocus={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-brand-red/70 ${
                active
                  ? 'bg-brand-red/12 text-rose-200'
                  : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span className="min-w-0 flex-1 break-words">{option.label}</span>
              {option.hint && <span className="text-ns-meta tabular-nums text-zinc-500">{option.hint}</span>}
              {active && <Check size={15} className="shrink-0 text-brand-red" aria-hidden="true" />}
            </button>
          );
        })}
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={`${label}: ${displayLabel}`}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-expanded={open}
        onClick={() => (open ? close() : openWithIndex())}
        onKeyDown={handleTriggerKeyDown}
        data-testid={testId}
        className={`ns-discover-filter-trigger ${selectedValue ? 'is-selected' : ''}`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown size={15} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {typeof document === 'undefined' ? null : createPortal(panel, document.body)}
    </>
  );
}
