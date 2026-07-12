/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Compass, Search, Heart, ListMusic, Upload, Radio, ShieldCheck, Sliders } from 'lucide-react';
import { ViewType } from '../types';
import { useState } from 'react';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  userRole: 'Listener' | 'Creator' | 'Admin';
  onRoleChange: (role: 'Listener' | 'Creator' | 'Admin') => void;
}

export default function Sidebar({ currentView, onViewChange, userRole, onRoleChange }: SidebarProps) {
  const [showDevMenu, setShowDevMenu] = useState(false);

  const menuItems = [
    { id: 'discover' as ViewType, label: 'Огляд', icon: Compass },
    { id: 'search' as ViewType, label: 'Пошук', icon: Search },
    { id: 'library' as ViewType, label: 'Медіатека', icon: Heart },
    { id: 'playlists' as ViewType, label: 'Плейлисти', icon: ListMusic },
    { id: 'upload' as ViewType, label: 'Завантажити', icon: Upload },
    { id: 'author-studio' as ViewType, label: 'Студія автора', icon: Radio },
    { id: 'admin' as ViewType, label: 'Адмін-панель', icon: ShieldCheck },
  ];

  return (
    <aside id="sidebar-nav" className="w-64 bg-[#0a0a0c] border-r border-white/[0.04] flex flex-col h-screen fixed left-0 top-0 z-30 justify-between">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Brand Header */}
        <div className="p-6 border-b border-white/[0.04] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-brand rounded-full"></div>
            <span className="font-display font-bold text-xl tracking-tight text-white">NoirSound</span>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            // Check active state
            // playlists view is also part of library, but we map it directly
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer text-left relative group ${
                  isActive
                    ? 'bg-zinc-900/85 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
                }`}
              >
                {/* Thin left accent indicator */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-[2.5px] bg-brand rounded-r animate-fadeIn" />
                )}

                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors duration-200 ${isActive ? 'text-brand' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
                  <span className="font-sans">{item.label}</span>
                </div>
                
                {/* Visual indicator of special areas */}

              </button>
            );
          })}
        </nav>
      </div>

      {/* Discrete Role Switcher / Dev Simulation tool at bottom */}
      <div className="p-4 border-t border-white/[0.03] shrink-0 bg-[#070709]/60 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center border border-white/[0.05] overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80"
                alt="Avatar"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-300">Максим М.</p>
              <p className="text-[9px] font-mono text-zinc-500 uppercase">
                {userRole === 'Admin' ? 'Адміністратор' : userRole === 'Creator' ? 'Автор' : 'Слухач'}
              </p>
            </div>
          </div>

          {/* Discreet Developer Tool Toggle */}
          <button 
            onClick={() => setShowDevMenu(!showDevMenu)}
            className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 transition-all cursor-pointer"
            title="Симуляція ролей (Розробка)"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Small Absolute popup simulation menu */}
        {showDevMenu && (
          <div className="absolute bottom-16 right-4 left-4 bg-zinc-950 border border-white/[0.08] rounded-lg p-3 shadow-2xl z-50 animate-fadeIn">
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-2 text-center">Симуляція ролі користувача</p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => {
                  onRoleChange('Listener');
                  onViewChange('discover');
                  setShowDevMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-sans transition-colors cursor-pointer ${userRole === 'Listener' ? 'bg-brand/10 text-brand font-medium' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
              >
                Слухач (Listener)
              </button>
              <button
                onClick={() => {
                  onRoleChange('Creator');
                  onViewChange('author-studio');
                  setShowDevMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-sans transition-colors cursor-pointer ${userRole === 'Creator' ? 'bg-brand/10 text-brand font-medium' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
              >
                Автор (Creator)
              </button>
              <button
                onClick={() => {
                  onRoleChange('Admin');
                  onViewChange('admin');
                  setShowDevMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-sans transition-colors cursor-pointer ${userRole === 'Admin' ? 'bg-brand/10 text-brand font-medium' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
              >
                Адміністратор (Admin)
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
