import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ListMusic } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function MobileHeader({ onOpenDrawer }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-[var(--ns-z-header)] flex h-[var(--ns-mobile-header-height)] shrink-0 select-none items-center justify-between border-b border-[var(--ns-border-subtle)] bg-[var(--ns-bg)] px-4 pt-[var(--ns-safe-area-top)] lg:hidden">
      {/* Brand logo */}
      <BrandLogo size="sm" showSubtitle={false} />

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button
          onClick={() => navigate('/discover')}
          className="ns-icon-button cursor-pointer"
          title="Search"
          aria-label="Search"
        >
          <Search size={15} />
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
