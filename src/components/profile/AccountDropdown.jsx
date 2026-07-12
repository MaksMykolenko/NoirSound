import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Settings, LayoutDashboard, LogOut } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { useLogout } from '../../hooks/mutations/useAuth';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import ThemeSelector from '../settings/ThemeSelector';

export default function AccountDropdown({ isOpen, onClose, anchorRef }) {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const logoutMutation = useLogout();

  useEffect(() => {
    function handleOutsideClick(e) {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const handleNavigate = (path) => {
    navigate(path);
    onClose();
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      addToast("Signed out successfully.", "success");
    } catch {
      addToast("Failed to sign out.", "error");
    } finally {
      onClose();
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 z-[var(--ns-z-dropdown)] mt-2 w-64 rounded-lg border border-zinc-700/70 bg-zinc-950 py-1.5 shadow-xl"
      role="menu"
    >
      <button
        onClick={() => handleNavigate('/profile')}
        className="flex w-full cursor-pointer items-center space-x-3 px-4 py-2.5 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        role="menuitem"
      >
        <User size={14} className="text-zinc-500" />
        <span>{t('nav.profile')}</span>
      </button>

      <button
        onClick={() => handleNavigate('/profile?tab=settings')}
        className="flex w-full cursor-pointer items-center space-x-3 px-4 py-2.5 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        role="menuitem"
      >
        <Settings size={14} className="text-zinc-500" />
        <span>{t('header.profileSettings')}</span>
      </button>

      <button
        onClick={() => handleNavigate('/dashboard')}
        className="flex w-full cursor-pointer items-center space-x-3 px-4 py-2.5 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        role="menuitem"
      >
        <LayoutDashboard size={14} className="text-zinc-500" />
        <span>{t('header.creatorDashboard')}</span>
      </button>

      <div className="h-px bg-zinc-900/60 my-1"></div>

      <div className="px-3 py-2">
        <ThemeSelector compact />
      </div>

      <div className="h-px bg-zinc-900/60 my-1"></div>

      <div className="px-3 py-2">
        <LanguageSwitcher compact />
      </div>

      <div className="h-px bg-zinc-900/60 my-1"></div>

      <button
        onClick={handleLogout}
        className="flex w-full cursor-pointer items-center space-x-3 px-4 py-2.5 text-left text-xs font-medium text-rose-400 transition-colors hover:bg-rose-950/20 hover:text-rose-300"
        role="menuitem"
      >
        <LogOut size={14} />
        <span>{t('header.logout')}</span>
      </button>
    </div>
  );
}
