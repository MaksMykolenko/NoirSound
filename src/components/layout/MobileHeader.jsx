import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, ListMusic } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import BrandLogo from './BrandLogo';

export default function MobileHeader({ onOpenDrawer }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setAuthModalOpen } = useUserStore();

  return (
    <header className="sticky top-0 z-[var(--ns-z-header)] flex h-[var(--ns-mobile-header-height)] shrink-0 select-none items-center justify-between border-b border-[var(--ns-border-subtle)] bg-[var(--ns-bg)] px-4 pt-[var(--ns-safe-area-top)] lg:hidden">
      {/* Brand logo */}
      <BrandLogo size="sm" showSubtitle={false} />

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {!user && (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="ns-button-primary min-h-10 cursor-pointer px-2.5 text-sm sm:px-3"
          >
            {t('header.signIn')}
          </button>
        )}

        {/* Discover remains in the bottom navigation for signed-out users, so
            the explicit Sign In action gets enough room in the compact header. */}
        {user && (
          <button
            onClick={() => navigate('/discover')}
            className="ns-icon-button cursor-pointer"
            title="Search"
            aria-label="Search"
          >
            <Search size={15} />
          </button>
        )}

        {/* Open Library Drawer */}
        <button
          onClick={onOpenDrawer}
          className={`ns-icon-button cursor-pointer text-brand-red ${user ? '' : '!hidden min-[351px]:!inline-flex'}`}
          title="Library Drawer"
          aria-label="Open library drawer"
        >
          <ListMusic size={15} />
        </button>
      </div>
    </header>
  );
}
