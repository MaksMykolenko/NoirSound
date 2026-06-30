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
    <nav aria-label="Mobile navigation" className="lg:hidden fixed bottom-0 left-0 right-0 min-h-16 bg-zinc-950/96 border-t border-zinc-800/60 backdrop-blur-xl z-40 flex justify-around items-center px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_32px_rgba(0,0,0,0.52)] select-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 min-w-14 min-h-14 px-2 py-1 rounded-xl text-[11px] font-bold tracking-wide transition-all cursor-pointer ${
                isActive ? 'text-rose-300 bg-brand-red/8' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <Icon size={18} />
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
