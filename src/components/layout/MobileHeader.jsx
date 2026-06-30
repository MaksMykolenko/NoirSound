import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, ListMusic } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { useUserStore } from '../../store/userStore';
import FallbackAvatar from '../ui/FallbackAvatar';

export default function MobileHeader({ onOpenDrawer }) {
  const navigate = useNavigate();
  const { user } = useUserStore();

  return (
    <header className="lg:hidden flex items-center justify-between px-4 py-2.5 min-h-16 bg-zinc-950/88 border-b border-zinc-800/60 sticky top-0 z-40 backdrop-blur-xl select-none">
      {/* Brand logo */}
      <BrandLogo size="sm" showSubtitle={false} />

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* Search */}
        <button
          onClick={() => navigate('/discover')}
          className="ns-icon-button cursor-pointer"
          title="Search"
          aria-label="Search"
        >
          <Search size={15} />
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-full border border-zinc-800/80 bg-zinc-900 overflow-hidden cursor-pointer flex items-center justify-center shrink-0 transition-colors hover:border-brand-red/40"
          title="Profile"
          aria-label="Profile"
        >
          {user ? (
            <FallbackAvatar
              src={user.avatarUrl}
              name={user.displayName || user.username}
              className="w-full h-full text-[24px]"
              imageClassName="object-cover"
            />
          ) : (
            <User size={16} className="text-zinc-400" />
          )}
        </button>

        {/* Open Library Drawer */}
        <button
          onClick={onOpenDrawer}
          className="ns-icon-button text-brand-red cursor-pointer"
          title="Library Drawer"
          aria-label="Open library drawer"
        >
          <ListMusic size={15} />
        </button>
      </div>
    </header>
  );
}
