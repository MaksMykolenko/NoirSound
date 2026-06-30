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
    <header className="hidden lg:flex min-h-[72px] items-center justify-between gap-4 px-5 xl:px-6 py-3 bg-zinc-950/58 border-b border-zinc-800/55 backdrop-blur-xl sticky top-0 z-40 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      {/* Navigation and search */}
      <div className="flex items-center gap-3 xl:gap-5 flex-1 max-w-xl min-w-0">
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
            className="ns-field w-full pl-10 pr-4 py-2 rounded-full text-sm placeholder-zinc-500"
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
              className="flex min-h-11 items-center space-x-2.5 p-1.5 pl-3 pr-1.5 bg-zinc-900 border border-zinc-800/80 rounded-full cursor-pointer hover:bg-zinc-800/80 transition-colors select-none"
              aria-expanded={isDropdownOpen}
              aria-haspopup="menu"
            >
              <span className="text-xs font-semibold text-zinc-300 hidden xl:block">@{user.username}</span>
              <div className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center text-[var(--ns-on-accent)] font-bold shadow-[0_0_10px_var(--ns-accent-glow)] overflow-hidden">
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
            className="px-5 ns-button-primary text-sm rounded-full cursor-pointer"
          >
            {t('header.signIn')}
          </button>
        )}
      </div>
    </header>
  );
}
