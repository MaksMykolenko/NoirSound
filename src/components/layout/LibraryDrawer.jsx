import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import LibrarySidebarSection from './LibrarySidebarSection';

export default function LibraryDrawer({ isOpen, onClose }) {
  // Close drawer on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Background Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
      />

      {/* Slide-out Panel */}
      <div className="relative w-[320px] max-w-[90vw] h-full bg-zinc-950 border-r border-zinc-800/80 flex flex-col py-4 px-3.5 z-10 animate-slide-in-left shadow-[10px_0_40px_rgba(0,0,0,0.9)]" role="dialog" aria-modal="true" aria-label="Your library">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-2 pb-3 mb-2 border-b border-zinc-900/80 shrink-0">
          <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Library Workspace</span>
          <button
            onClick={onClose}
            className="ns-icon-button !min-h-8 !min-w-8 cursor-pointer text-zinc-400 hover:text-zinc-100"
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
      </div>
    </div>
  );
}
