import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Home, PlusCircle, LayoutDashboard, ShieldAlert } from 'lucide-react';
import LibrarySidebarSection from './LibrarySidebarSection';
import { usePlayerStore } from '../../store/playerStore';
import BrandLogo from './BrandLogo';
import { useUserStore } from '../../store/userStore';

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_DEFAULT_WIDTH = 256;
const SIDEBAR_MAX_WIDTH = 360;

export default function Sidebar() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const canCreate = ['ARTIST', 'ADMIN'].includes(user?.role);
  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/discover', label: t('nav.discover'), icon: Compass },
    ...(canCreate ? [
      { to: '/upload', label: t('nav.upload'), icon: PlusCircle },
      { to: '/dashboard', label: t('header.creatorDashboard'), icon: LayoutDashboard },
    ] : []),
    ...(user?.role === 'ADMIN' ? [
      { to: '/admin', label: t('admin.admin'), icon: ShieldAlert },
    ] : []),
  ];

  const { isPlayerCollapsed } = usePlayerStore();
  const sidebarBottomPadding = isPlayerCollapsed ? 'pb-4' : 'pb-[var(--ns-player-height)]';
  const resizeHandleBottom = isPlayerCollapsed
    ? 'bottom-0'
    : 'bottom-[var(--ns-player-height)]';

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("noirsound.sidebarWidth");
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= SIDEBAR_MIN_WIDTH && parsed <= SIDEBAR_MAX_WIDTH) {
      return parsed;
    }
    return SIDEBAR_DEFAULT_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startResize = (e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.classList.add('is-sidebar-resizing');
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (e) => {
      const nextWidth = Math.min(Math.max(e.clientX, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
      setSidebarWidth(nextWidth);
      localStorage.setItem("noirsound.sidebarWidth", String(nextWidth));
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      document.body.classList.remove('is-sidebar-resizing');
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing]);

  const handleDoubleClick = () => {
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    localStorage.setItem("noirsound.sidebarWidth", String(SIDEBAR_DEFAULT_WIDTH));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextWidth = Math.max(sidebarWidth - 16, SIDEBAR_MIN_WIDTH);
      setSidebarWidth(nextWidth);
      localStorage.setItem("noirsound.sidebarWidth", String(nextWidth));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextWidth = Math.min(sidebarWidth + 16, SIDEBAR_MAX_WIDTH);
      setSidebarWidth(nextWidth);
      localStorage.setItem("noirsound.sidebarWidth", String(nextWidth));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
      localStorage.setItem("noirsound.sidebarWidth", String(SIDEBAR_MIN_WIDTH));
    } else if (e.key === 'End') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
      localStorage.setItem("noirsound.sidebarWidth", String(SIDEBAR_MAX_WIDTH));
    }
  };

  const styleWidth = isLargeScreen ? sidebarWidth : SIDEBAR_MIN_WIDTH;

  return (
    <aside
      style={{ width: `${styleWidth}px` }}
      className={`relative hidden h-[100dvh] shrink-0 flex-col justify-between overflow-hidden border-r border-[var(--ns-border-subtle)] bg-brand-dark px-4 pt-4 transition-[width,padding] duration-200 lg:flex ${sidebarBottomPadding}`}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Brand logo */}
        <BrandLogo />

        {/* Navigation links */}
        <nav className="shrink-0 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? 'border-transparent bg-zinc-900/85 text-white shadow-[inset_2.5px_0_0_var(--ns-accent)]'
                      : 'border-transparent text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="my-1 shrink-0 border-t border-[var(--ns-border-subtle)]" />

        {/* Scrollable Library Section */}
        <div className="flex-1 min-h-0 flex flex-col">
          <LibrarySidebarSection />
        </div>
      </div>



      {/* Resize Handle */}
      {isLargeScreen && (
        <div
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onMouseDown={startResize}
          onPointerDown={startResize}
          onDoubleClick={handleDoubleClick}
          onKeyDown={handleKeyDown}
          className={`group/handle absolute right-0 top-0 z-[var(--ns-z-dropdown)] w-2 cursor-col-resize select-none transition-all focus:outline-none focus-visible:bg-zinc-900/50 focus-visible:ring-1 focus-visible:ring-brand-red/50 ${resizeHandleBottom}`}
        >
          {/* Visual line */}
          <div
            className={`w-[2px] h-full mx-auto transition-all duration-150 ${
              isResizing
                ? 'bg-brand-red opacity-100'
                : 'bg-zinc-800 opacity-0 group-hover/handle:opacity-100 group-hover/handle:bg-zinc-700 group-focus-visible/handle:opacity-100 group-focus-visible/handle:bg-brand-red'
            }`}
          />
        </div>
      )}
    </aside>
  );
}
