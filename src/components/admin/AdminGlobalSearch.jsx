import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { searchAdmin } from '../../api/admin';
import { StatusBadge } from './AdminUI';

const RECENT_KEY = 'noirsound_admin_recent_searches';

function readRecent() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

export default function AdminGlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState([]);
  const [recent, setRecent] = useState(readRecent);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(-1);
  const items = useMemo(() => groups.flatMap(group => group.items.map(item => ({ ...item, type: group.type }))), [groups]);

  useEffect(() => {
    function shortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    function outside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    window.addEventListener('keydown', shortcut);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', shortcut);
      document.removeEventListener('pointerdown', outside);
    };
  }, []);

  useEffect(() => {
    const value = query.trim();
    setActive(-1);
    if (value.length < 2) {
      setGroups([]);
      setLoading(false);
      setError(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const timer = window.setTimeout(() => {
      searchAdmin(value, { signal: controller.signal })
        .then(result => setGroups(result?.groups || []))
        .catch(searchError => {
          if (searchError?.name !== 'AbortError') {
            setGroups([]);
            setError(true);
          }
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function remember(value) {
    const next = [value, ...recent.filter(item => item !== value)].slice(0, 5);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  function select(item) {
    remember(query.trim() || item.title);
    setOpen(false);
    setQuery('');
    navigate(item.to);
  }

  function keyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      inputRef.current?.focus();
    } else if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      setActive(index => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault();
      setActive(index => (index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === 'Enter' && active >= 0 && items[active]) {
      event.preventDefault();
      select(items[active]);
    }
  }

  let itemIndex = -1;
  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:max-w-2xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--ns-text-muted)]" aria-hidden="true" />
      <input ref={inputRef} type="search" role="combobox" aria-expanded={open} aria-controls="admin-global-search-results" aria-activedescendant={active >= 0 ? `admin-search-result-${active}` : undefined} aria-autocomplete="list" value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} onKeyDown={keyDown} placeholder={t('admin.globalSearch.placeholder')} aria-label={t('admin.globalSearch.placeholder')} className="ns-field h-10 w-full rounded pl-9 pr-20 text-base sm:text-sm" />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--ns-border)] px-1.5 py-0.5 text-ns-meta text-[var(--ns-text-muted)] sm:block">⌘K</kbd>
      {query && <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--ns-text-muted)] sm:right-12" aria-label={t('admin.globalSearch.clear')}><X className="h-4 w-4" /></button>}
      {open && (
        <div id="admin-global-search-results" role="listbox" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[var(--ns-z-dropdown)] max-h-[min(32rem,70dvh)] overflow-y-auto rounded-md border border-[var(--ns-border)] bg-[var(--ns-card-solid)] shadow-[var(--ns-shadow-modal)]">
          {query.trim().length < 2 ? (
            <div className="p-3"><p className="text-ns-label font-semibold uppercase tracking-ns-label text-[var(--ns-text-faint)]">{t('admin.globalSearch.recent')}</p>{recent.length ? <div className="mt-2 flex flex-wrap gap-2">{recent.map(value => <button key={value} type="button" onClick={() => setQuery(value)} className="ns-button-secondary rounded px-2.5 py-1.5 text-xs">{value}</button>)}</div> : <p className="mt-2 text-sm text-[var(--ns-text-muted)]">{t('admin.globalSearch.hint')}</p>}</div>
          ) : loading ? <p className="p-5 text-center text-sm text-[var(--ns-text-muted)]" role="status">{t('admin.globalSearch.loading')}</p>
            : error ? <p className="p-5 text-center text-sm text-[var(--ns-danger)]" role="alert">{t('admin.globalSearch.error')}</p>
              : items.length === 0 ? <p className="p-5 text-center text-sm text-[var(--ns-text-muted)]">{t('admin.globalSearch.empty')}</p>
              : groups.map(group => <section role="group" key={group.type} aria-labelledby={`admin-search-${group.type}`}><h2 id={`admin-search-${group.type}`} className="border-y border-[var(--ns-border-subtle)] bg-[var(--ns-card-soft)] px-3 py-1.5 text-ns-meta font-semibold uppercase tracking-ns-label text-[var(--ns-text-faint)]">{t(`admin.globalSearch.groups.${group.type}`)}</h2>{group.items.map(item => {
                itemIndex += 1;
                const index = itemIndex;
                return <button id={`admin-search-result-${index}`} role="option" aria-selected={active === index} key={`${group.type}-${item.id}`} type="button" onMouseEnter={() => setActive(index)} onClick={() => select({ ...item, type: group.type })} className={`flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left ${active === index ? 'bg-[var(--ns-surface-active)]' : 'hover:bg-[var(--ns-hover-bg)]'}`}><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.title}</strong>{item.subtitle && <span className="block truncate text-xs text-[var(--ns-text-muted)]">{item.subtitle}</span>}</span>{item.status && <StatusBadge status={item.status} />}</button>;
              })}</section>) }
        </div>
      )}
    </div>
  );
}
