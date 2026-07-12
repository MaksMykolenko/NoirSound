import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Home, Library, PlusCircle, User } from 'lucide-react';
import { useUserStore } from '../../store/userStore';

export default function MobileNavbar() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const canCreate = ['ARTIST', 'ADMIN'].includes(user?.role);
  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/discover', label: t('nav.discover'), icon: Compass },
    { to: '/library', label: t('nav.library'), icon: Library },
    ...(canCreate ? [{ to: '/upload', label: t('nav.upload'), icon: PlusCircle }] : []),
    { to: '/profile', label: t('nav.profile'), icon: User },
  ];

  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-[var(--ns-z-mobile-nav)] flex min-h-[var(--ns-mobile-nav-height)] select-none items-center justify-around border-t border-[var(--ns-border-subtle)] bg-[color-mix(in_srgb,var(--ns-player-bg)_96%,transparent)] px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-h-14 min-w-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-2 py-1 font-sans tabular-nums text-ns-meta font-medium transition-colors ${
                isActive ? 'bg-zinc-900/70 text-brand-red' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <Icon size={18} />
            <span className="text-ns-meta">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
