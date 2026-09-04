import React from 'react';
import { X } from 'lucide-react';
import LibrarySidebarSection from './LibrarySidebarSection';
import BrandLogo from './BrandLogo';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';
import LanguageSwitcher from '../ui/LanguageSwitcher';

export default function LibraryDrawer({ isOpen, onClose }) {
  const dialogRef = useDialogFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[var(--ns-z-overlay)] flex lg:hidden">
      {/* Background Overlay */}
      <button
        type="button"
        aria-label="Close library drawer"
        onClick={onClose}
        className="fixed inset-0 bg-black/60 transition-opacity duration-200 animate-fade-in"
      />

      {/* Slide-out Panel */}
      <div ref={dialogRef} className="relative z-10 flex h-full w-[320px] max-w-[90vw] animate-slide-in-left flex-col border-r border-[var(--ns-border-subtle)] bg-[var(--ns-bg-elevated)] px-3.5 py-4 shadow-lg" role="dialog" aria-modal="true" aria-label="Your library">
        
        {/* Top Header Bar */}
        <div className="mb-2 flex shrink-0 items-center justify-between border-b border-zinc-900/80 pb-3 pl-0.5 pr-2">
          <BrandLogo size="sm" showSubtitle={false} onClick={onClose} />
          <button
            onClick={onClose}
            className="ns-media-action cursor-pointer text-zinc-400 hover:text-zinc-100"
            title="Close Library"
            aria-label="Close library"
          >
            <X size={15} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          <LibrarySidebarSection onItemClick={onClose} />
        </div>

        {/* Drawer Footer */}
        <div className="mt-3 shrink-0 border-t border-zinc-900/80 pt-3">
          <LanguageSwitcher compact />
        </div>
      </div>
    </div>
  );
}
