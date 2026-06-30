import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Home, PlusCircle, LayoutDashboard, ShieldAlert } from 'lucide-react';
import LibrarySidebarSection from './LibrarySidebarSection';
import { usePlayerStore } from '../../store/playerStore';
import BrandLogo from './BrandLogo';
import { useUserStore } from '../../store/userStore';

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_DEFAULT_WIDTH = 272;
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

  const { isPlayerCollapsed, currentTrack } = usePlayerStore();
  const sidebarBottomPadding = isPlayerCollapsed
    ? 'pb-5'
    : currentTrack
      ? 'pb-28'
      : 'pb-16';
  const resizeHandleBottom = isPlayerCollapsed
    ? 'bottom-0'
    : currentTrack
      ? 'bottom-[90px]'
      : 'bottom-[48px]';

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
      className={`hidden lg:flex flex-col bg-zinc-950/82 border-r border-zinc-800/60 h-[100dvh] sticky top-0 pt-5 px-3.5 justify-between shrink-0 overflow-hidden relative transition-all duration-300 ${sidebarBottomPadding}`}
    >
      <div className="flex flex-col flex-1 min-h-0 space-y-5">
        {/* Brand logo */}
        <BrandLogo />

        {/* Navigation links */}
        <nav className="space-y-1 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3.5 px-3.5 py-2.5 min-h-11 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-red/14 to-purple-500/5 text-rose-300 border border-brand-red/25 shadow-[inset_3px_0_0_var(--ns-accent)]'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/65 border border-transparent'
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
        <div className="border-t border-zinc-900/80 my-2 shrink-0"></div>

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
          className={`absolute right-0 top-0 w-2 cursor-col-resize z-50 transition-all group/handle select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-red/50 focus-visible:bg-zinc-900/50 ${resizeHandleBottom}`}
        >
          {/* Visual line */}
          <div
            className={`w-[2px] h-full mx-auto transition-all duration-150 ${
              isResizing
                ? 'bg-brand-red shadow-[0_0_10px_var(--ns-accent-glow)] opacity-100'
                : 'bg-zinc-800 opacity-0 group-hover/handle:opacity-100 group-hover/handle:bg-zinc-700 group-focus-visible/handle:opacity-100 group-focus-visible/handle:bg-brand-red'
            }`}
          />
        </div>
      )}
    </aside>
  );
}
