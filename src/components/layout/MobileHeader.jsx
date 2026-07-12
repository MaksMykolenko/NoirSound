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
    <header className="sticky top-0 z-[var(--ns-z-header)] flex h-[var(--ns-mobile-header-height)] shrink-0 select-none items-center justify-between border-b border-[var(--ns-border-subtle)] bg-[color-mix(in_srgb,var(--ns-bg)_92%,transparent)] px-4 backdrop-blur-md lg:hidden">
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
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-[var(--ns-border-subtle)] bg-zinc-900 transition-colors hover:border-brand-red/40"
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
