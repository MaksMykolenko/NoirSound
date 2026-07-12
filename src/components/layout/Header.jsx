import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import AccountDropdown from '../profile/AccountDropdown';
import FallbackAvatar from '../ui/FallbackAvatar';

export default function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setAuthModalOpen } = useUserStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const pillRef = useRef(null);

  return (
    <header className="sticky top-0 z-[var(--ns-z-header)] hidden h-[var(--ns-header-height)] shrink-0 items-center justify-between gap-4 border-b border-[var(--ns-border-subtle)] bg-[var(--ns-bg)] px-6 lg:flex lg:px-8">
      {/* Navigation and search */}
      <div className="flex min-w-0 max-w-xl flex-1 items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="ns-icon-button cursor-pointer"
            aria-label="Go back"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => navigate(1)}
            className="ns-icon-button cursor-pointer"
            aria-label="Go forward"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            readOnly
            onFocus={() => navigate('/discover')}
            placeholder={t('header.searchPlaceholder')}
            className="ns-field w-full rounded-md py-2 pl-10 pr-4 text-sm placeholder-zinc-600"
            aria-label="Search NoirSound"
          />
        </div>
      </div>

        {/* User options */}
      <div className="flex items-center gap-2.5 xl:gap-3 shrink-0">
        {user ? (
          <div className="relative" ref={pillRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-md py-1 pl-3 pr-1 transition-colors hover:bg-surface-hover"
              aria-expanded={isDropdownOpen}
              aria-haspopup="menu"
            >
              <span className="text-sm font-semibold text-zinc-300 hidden xl:block">@{user.username}</span>
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-red font-bold text-[var(--ns-on-accent)]">
                <FallbackAvatar
                  src={user.avatarUrl}
                  name={user.displayName || user.username}
                  className="w-full h-full text-[30px]"
                  imageClassName="object-cover"
                />
              </div>
            </button>
            
            <AccountDropdown
              isOpen={isDropdownOpen}
              onClose={() => setIsDropdownOpen(false)}
              anchorRef={pillRef}
            />
          </div>
        ) : (
          <button 
            onClick={() => setAuthModalOpen(true)}
            className="ns-button-primary cursor-pointer px-5 text-sm"
          >
            {t('header.signIn')}
          </button>
        )}
      </div>
    </header>
  );
}
