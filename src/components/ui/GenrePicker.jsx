import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { GENRE_GROUPS } from '../../constants/musicGenres';
import { getGenreLabel, getGenreGroupLabel, searchGenres } from '../../utils/genreLabels';

/**
 * Searchable, grouped, single-select genre picker.
 * Stores/returns stable genre KEYS; renders localized labels.
 *
 * Desktop: anchored dropdown under the trigger.
 * Mobile (<640px): bottom sheet above the nav/mini-player with a backdrop and
 * internal scroll, so it never gets clipped or covered.
 *
 * Props:
 *  - value: selected genre key (string | null)
 *  - onChange: (key) => void
 *  - id, ariaLabel, placeholder, buttonClassName
 */
export default function GenrePicker({
  value,
  onChange,
  id = 'genre-picker',
  ariaLabel,
  placeholder,
  buttonClassName = '',
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const language = i18n.language;
  const label = ariaLabel || t('uploadForm.primaryGenre');

  const grouped = useMemo(() => {
    const results = searchGenres(query, language);
    const byGroup = new Map();
    for (const item of results) {
      if (!byGroup.has(item.group)) byGroup.set(item.group, []);
      byGroup.get(item.group).push(item);
    }
    // Preserve canonical group order.
    return GENRE_GROUPS
      .filter((g) => byGroup.has(g))
      .map((g) => ({ group: g, label: getGenreGroupLabel(g, language), items: byGroup.get(g) }));
  }, [query, language]);

  const totalResults = useMemo(
    () => grouped.reduce((sum, g) => sum + g.items.length, 0),
    [grouped]
  );

  // Close on outside pointer + Escape (Escape also returns focus to the trigger).
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('[data-testid="genre-picker-trigger"]')?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Autofocus the search on desktop only — on mobile this would pop the keyboard
  // over the bottom sheet before the user can scroll the list.
  useEffect(() => {
    if (!open || !searchRef.current) return;
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 640px)').matches;
    if (isDesktop) searchRef.current.focus();
  }, [open]);

  const handleSelect = (key) => {
    onChange?.(key);
    setOpen(false);
    setQuery('');
  };

  // Roving keyboard focus across the visible options.
  const moveOptionFocus = (dir) => {
    const opts = panelRef.current
      ? Array.from(panelRef.current.querySelectorAll('[data-genre-option]'))
      : [];
    if (!opts.length) return;
    const idx = opts.indexOf(document.activeElement);
    let next = 0;
    if (dir === 'down') next = idx < 0 ? 0 : Math.min(idx + 1, opts.length - 1);
    else if (dir === 'up') next = idx <= 0 ? 0 : idx - 1;
    else if (dir === 'end') next = opts.length - 1;
    opts[next]?.focus();
  };

  const onPanelKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveOptionFocus('down'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveOptionFocus('up'); }
    else if (e.key === 'Home') { e.preventDefault(); moveOptionFocus('home'); }
    else if (e.key === 'End') { e.preventDefault(); moveOptionFocus('end'); }
  };

  const selectedLabel = value ? getGenreLabel(value, language) : '';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={id}
        data-testid="genre-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`ns-field px-4 text-sm flex items-center justify-between gap-2 text-left ${
          value ? 'text-zinc-200' : 'text-zinc-500'
        } ${buttonClassName}`}
      >
        <span className="truncate">
          {selectedLabel || placeholder || t('uploadForm.selectGenre')}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Mobile backdrop (sits below the sheet, above app chrome). */}
          <div
            className="fixed inset-0 z-[var(--ns-z-overlay)] bg-black/75 sm:hidden"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />

          <div
            ref={panelRef}
            data-testid="genre-picker-panel"
            onKeyDown={onPanelKeyDown}
            className="fixed inset-x-0 bottom-0 z-[var(--ns-z-player-sheet)] flex max-h-[80vh] flex-col overflow-hidden rounded-t-lg border border-zinc-700/70 bg-zinc-950 p-0 shadow-xl
                       sm:absolute sm:inset-x-0 sm:bottom-auto sm:z-[var(--ns-z-dropdown)] sm:mt-2 sm:max-h-none sm:rounded-lg"
          >
            {/* Mobile sheet header (title + close) */}
            <div className="sm:hidden flex items-center justify-between px-4 pt-3 pb-2 border-b border-zinc-800/70 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 truncate pr-2">{label}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('actions.close')}
                className="ns-icon-button h-9 w-9 shrink-0 rounded"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="p-2.5 border-b border-zinc-800/80 bg-zinc-950/60 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
                <input
                  ref={searchRef}
                  type="search"
                  data-testid="genre-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('uploadForm.searchGenres')}
                  className="ns-field pl-9 pr-3 text-sm"
                  aria-label={t('uploadForm.searchGenres')}
                />
              </div>
            </div>

            {/* Options */}
            <div
              role="listbox"
              aria-label={label}
              className="flex-1 max-h-[56vh] sm:max-h-72 overflow-y-auto overscroll-contain py-1 ns-tabs-scroll pb-[env(safe-area-inset-bottom)]"
            >
              {totalResults === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-zinc-500">
                  {t('uploadForm.noGenreMatch')}
                </p>
              ) : (
                grouped.map(({ group, label: groupLabel, items }) => (
                  <div key={group} className="py-1">
                    <div
                      data-genre-group={group}
                      className="sticky top-0 z-10 bg-zinc-950 px-3 py-1 font-mono text-[9px] font-medium uppercase tracking-wider text-zinc-500"
                    >
                      {groupLabel}
                    </div>
                    {items.map((item) => {
                      const active = item.key === value;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="option"
                          aria-selected={active}
                          data-genre-option={item.key}
                          onClick={() => handleSelect(item.key)}
                          className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 sm:py-2 text-left text-sm transition-colors cursor-pointer ${
                            active
                              ? 'bg-brand-red/15 text-brand-red'
                              : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {active && <Check size={15} className="shrink-0 text-brand-red" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Clear selection */}
            {value && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="shrink-0 w-full flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 border-t border-zinc-800/80 bg-zinc-950/40 cursor-pointer"
              >
                <X size={13} /> {t('actions.clear')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
