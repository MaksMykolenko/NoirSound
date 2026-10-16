import React, { useState, useRef, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { THEMES, THEME_IDS } from '../../theme/themes';
import { useThemeStore } from '../../store/themeStore';

export default function ThemeSwitcher({
  variant = 'dropdown',
  placement = 'bottom',
  className = '',
}) {
  const { t } = useTranslation();
  const selectedTheme = useThemeStore((state) => state.selectedTheme);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const embedded = variant === 'account';

  useEffect(() => {
    if (!embedded || !isOpen) return;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector('[aria-checked="true"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [embedded, isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event) => {
    if (!embedded || event.defaultPrevented) return;
    if (isOpen && ['Escape', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }
    if (!menuRef.current?.contains(event.target)) return;
    const options = [...menuRef.current.querySelectorAll('[role="menuitemradio"]')];
    const current = options.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? (current + 1) % options.length
      : event.key === 'ArrowUp' ? (current - 1 + options.length) % options.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    options[next]?.focus();
  };

  const activeTheme = THEMES[selectedTheme] || THEMES['noir-pink'];
  const previewAccent = selectedTheme === 'system'
    ? (THEMES[resolvedTheme]?.colors?.accent || activeTheme.colors.accent)
    : activeTheme.colors.accent;

  // Handle outside click & escape
  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (variant === 'select') {
    return (
      <label
        data-testid="theme-switcher-select"
        className={`relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-zinc-800/80 bg-zinc-900/80 px-2 text-xs text-zinc-300 focus-within:ring-2 focus-within:ring-brand-red ${className}`}
        title={t('settings.appearance')}
      >
        <Palette size={13} className="text-brand-red shrink-0" aria-hidden="true" />
        <span
          className="h-2.5 w-2.5 rounded-full border border-white/20 shrink-0"
          style={{ backgroundColor: previewAccent }}
          aria-hidden="true"
        />
        <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
        <select
          value={selectedTheme}
          onChange={(e) => setTheme(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={t('settings.appearance')}
        >
          {THEME_IDS.map((id) => (
            <option key={id} value={id} className="bg-zinc-950 text-zinc-200">
              {t(THEMES[id].labelKey)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const menuPlacementClass = placement === 'top'
    ? 'bottom-full mb-2'
    : 'top-full mt-2';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} onKeyDown={handleMenuKeyDown}>
      <button
        type="button"
        data-testid="theme-switcher-dropdown"
        ref={triggerRef}
        role={embedded ? 'menuitem' : undefined}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex cursor-pointer select-none items-center gap-2 rounded-md border border-zinc-800/80 bg-zinc-900/80 px-2.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${embedded ? 'min-h-11 w-full' : 'h-9'}`}
        aria-haspopup="menu"
        aria-controls={isOpen ? menuId : undefined}
        aria-label={embedded ? `${t('settings.appearance')}: ${t(activeTheme.labelKey)}` : undefined}
        aria-expanded={isOpen}
        title={t('settings.appearance')}
      >
        <Palette size={14} className="text-zinc-400 group-hover:text-zinc-200 transition-colors" />
        <span
          className="h-2.5 w-2.5 rounded-full border border-white/20 shrink-0"
          style={{ backgroundColor: previewAccent }}
          aria-hidden="true"
        />
        <span className={`${embedded ? 'min-w-0 flex-1 truncate text-left' : 'hidden xl:inline'} font-sans text-ns-meta font-medium`}>
          {t(activeTheme.labelKey)}
        </span>
        <ChevronDown
          size={12}
          className={`text-zinc-500 transition-transform duration-200 ${isOpen ? (placement === 'top' ? '-rotate-180' : 'rotate-180') : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          ref={menuRef}
          id={menuId}
          aria-label={t('settings.appearance')}
          data-testid="theme-switcher-menu"
          className={`${embedded ? 'relative mt-2 w-full max-h-[40dvh]' : `absolute right-0 ${menuPlacementClass} w-64 max-h-[calc(100dvh-6rem)]`} overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-[var(--ns-shadow-modal)] z-[var(--ns-z-dropdown)] backdrop-blur-md`}
        >
          <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              {t('settings.appearance')}
            </p>
          </div>

          <div className="space-y-0.5">
            {THEME_IDS.map((themeId) => {
              const theme = THEMES[themeId];
              const isSelected = selectedTheme === themeId;
              const isSystem = themeId === 'system';
              const themeAccent = isSystem
                ? (THEMES[resolvedTheme]?.colors?.accent || theme.colors.accent)
                : theme.colors.accent;

              return (
                <button
                  key={themeId}
                  type="button"
                  role={embedded ? 'menuitemradio' : 'menuitem'}
                  aria-checked={embedded ? isSelected : undefined}
                  tabIndex={embedded ? (isSelected ? 0 : -1) : undefined}
                  onClick={() => {
                    setTheme(themeId);
                    closeMenu();
                  }}
                  className={`min-h-11 w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-red ${
                    isSelected
                      ? 'bg-zinc-800/70 text-[var(--ns-text-primary)]'
                      : 'hover:bg-zinc-900 text-zinc-300 hover:text-[var(--ns-text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-3.5 w-3.5 rounded-full shrink-0 border border-white/20"
                      style={{ backgroundColor: themeAccent }}
                      aria-hidden="true"
                    />
                    <div className="truncate">
                      <p className="text-xs font-medium leading-tight truncate">
                        {t(theme.labelKey)}
                      </p>
                      {theme.descriptionKey && (
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                          {t(theme.descriptionKey)}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={14} className="text-brand-red shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
