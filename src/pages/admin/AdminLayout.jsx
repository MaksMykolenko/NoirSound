import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, BarChart3, ChevronLeft, ChevronRight, Flag, Gauge,
  HardDriveUpload, LogOut, MessageSquare, Music2, Radio, ScrollText,
  Settings, ShieldAlert, UserRound, UsersRound,
} from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { AdminLoading } from '../../components/admin/AdminUI';
import LanguageSwitcher from '../../components/ui/LanguageSwitcher';
import AdminGlobalSearch from '../../components/admin/AdminGlobalSearch';
import { adminEnvironment } from '../../config/adminEnvironment';

const NAV_GROUPS = [
  ['overviewGroup', [['overview', 'overview', Gauge]]],
  ['moderationGroup', [['reports', 'reports', Flag], ['comments', 'comments', MessageSquare]]],
  ['catalogGroup', [['tracks', 'tracks', Music2], ['artists', 'artists', UserRound]]],
  ['usersGroup', [['users', 'users', UsersRound]]],
  ['operationsGroup', [['uploads', 'uploads', HardDriveUpload], ['system', 'system', Activity], ['system/stats', 'statsIntegrity.navLabel', BarChart3]]],
  ['systemGroup', [['audit-logs', 'auditLogs', ScrollText], ['settings', 'settings', Settings]]],
];

export function AdminAccessGuard({ children }) {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const authHydrated = useUserStore((state) => state.authHydrated);
  const setAuthModalOpen = useUserStore((state) => state.setAuthModalOpen);

  if (!authHydrated) return <div className="min-h-screen bg-[var(--ns-bg)]"><AdminLoading /></div>;
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ns-bg)] p-6 text-center">
        <div className="max-w-lg">
          <ShieldAlert className="mx-auto h-10 w-10 text-[var(--ns-accent)]" />
          <h1 className="mt-4 font-sans text-xl font-bold">{t('admin.signInRequired')}</h1>
          <p className="mt-2 text-sm text-[var(--ns-text-muted)]">{t('admin.signInRequiredDescription')}</p>
          <button type="button" onClick={() => setAuthModalOpen(true)} className="ns-button-primary mt-5 rounded px-5 py-2.5 text-sm">{t('header.signIn')}</button>
        </div>
      </main>
    );
  }
  if (user.role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ns-bg)] p-6 text-center" data-testid="admin-access-denied">
        <div className="max-w-lg">
          <ShieldAlert className="mx-auto h-10 w-10 text-[var(--ns-danger)]" />
          <h1 className="mt-4 font-sans text-xl font-bold">{t('admin.accessDenied')}</h1>
          <p className="mt-2 text-sm text-[var(--ns-text-muted)]">{t('admin.adminOnly')}</p>
          <Link to="/" className="ns-button-secondary mt-5 inline-flex rounded px-5 py-2.5 text-sm">{t('admin.backToNoirSound')}</Link>
        </div>
      </main>
    );
  }
  return children;
}

export function AdminShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const logoutUser = useUserStore((state) => state.logoutUser);
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('noirsound_admin_sidebar_collapsed');
    return stored == null ? window.matchMedia?.('(max-width: 1100px)').matches : stored === 'true';
  });

  useEffect(() => {
    window.dispatchEvent(new Event('noirsound:admin-enter'));
  }, []);

  function toggleSidebar() {
    setCollapsed((value) => {
      localStorage.setItem('noirsound_admin_sidebar_collapsed', String(!value));
      return !value;
    });
  }

  async function signOut() {
    await logoutUser();
    navigate('/');
  }

  return (
    <div className="flex h-[100dvh] min-w-0 overflow-hidden bg-[var(--ns-bg)] font-sans text-[var(--ns-text)]" data-testid="admin-shell">
      <aside className={`${collapsed ? 'w-[4.5rem]' : 'w-64'} flex shrink-0 flex-col border-r border-[var(--ns-border-subtle)] bg-[var(--ns-bg-elevated)] transition-[width] duration-200 motion-reduce:transition-none`} data-testid="admin-sidebar">
        <div className="flex h-16 items-center gap-3 border-b border-[var(--ns-border-subtle)] px-3">
          <Link to="/admin/overview" className="flex min-w-0 flex-1 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-focus-ring)]" aria-label={`NoirSound ${t('admin.admin')}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--ns-accent-border)] bg-[var(--ns-accent-soft)] text-[var(--ns-accent)]"><Radio className="h-4 w-4" /></span>
            <span className={collapsed ? 'sr-only' : 'min-w-0'}><strong className="block truncate text-sm">NoirSound</strong><span className="block text-ns-meta font-semibold uppercase tracking-ns-label text-[var(--ns-accent)]">{t('admin.admin')}</span></span>
          </Link>
          {!collapsed && <button type="button" onClick={toggleSidebar} className="ns-icon-button" aria-label={t('admin.collapseSidebar')} title={t('admin.collapseSidebar')}><ChevronLeft className="h-4 w-4" /></button>}
        </div>
        {collapsed && <button type="button" onClick={toggleSidebar} className="mx-auto mt-2 ns-icon-button" aria-label={t('admin.expandSidebar')} title={t('admin.expandSidebar')}><ChevronRight className="h-4 w-4" /></button>}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label={t('admin.adminNavigation')}>
          {NAV_GROUPS.map(([group, links]) => (
            <div key={group} className="mb-4">
              <p className={collapsed ? 'sr-only' : 'mb-1 px-2 text-ns-meta font-semibold uppercase tracking-ns-label text-[var(--ns-text-faint)]'}>{t(`admin.${group}`)}</p>
              <div className="space-y-0.5">{links.map(([path, key, Icon]) => (
                <NavLink key={path} to={`/admin/${path}`} end={path === 'system'} title={collapsed ? t(`admin.${key}`) : undefined} className={({ isActive }) => `flex min-h-10 items-center gap-2.5 rounded border-l-2 px-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-focus-ring)] ${isActive ? 'border-[var(--ns-accent)] bg-[var(--ns-accent-soft)] text-[var(--ns-accent-text)]' : 'border-transparent text-[var(--ns-text-muted)] hover:bg-[var(--ns-hover-bg)] hover:text-[var(--ns-text)]'}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className={collapsed ? 'sr-only' : 'truncate'}>{t(`admin.${key}`)}</span>
                </NavLink>
              ))}</div>
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--ns-border-subtle)] p-2">
          <div className={`mb-2 flex items-center gap-2 rounded px-2 py-2 ${collapsed ? 'justify-center' : ''}`} title={collapsed ? `${user.displayName} · ${user.role}` : undefined}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ns-surface-active)] text-xs font-bold">{user.displayName?.slice(0, 1) || 'A'}</span>
            <span className={collapsed ? 'sr-only' : 'min-w-0'}><strong className="block truncate text-xs">{user.displayName}</strong><span className="block text-ns-meta text-[var(--ns-text-muted)]">{t(`admin.statusValues.${user.role}`, { defaultValue: user.role })}</span></span>
          </div>
          <Link to="/" title={collapsed ? t('admin.backToNoirSound') : undefined} className="flex min-h-10 items-center gap-2 rounded px-2.5 text-sm text-[var(--ns-text-muted)] hover:bg-[var(--ns-hover-bg)] hover:text-[var(--ns-text)]"><ChevronLeft className="h-4 w-4 shrink-0" /><span className={collapsed ? 'sr-only' : ''}>{t('admin.backToNoirSound')}</span></Link>
          <button type="button" onClick={signOut} title={collapsed ? t('admin.signOut') : undefined} className="flex min-h-10 w-full items-center gap-2 rounded px-2.5 text-sm text-[var(--ns-text-muted)] hover:bg-[var(--ns-hover-bg)] hover:text-[var(--ns-text)]"><LogOut className="h-4 w-4 shrink-0" /><span className={collapsed ? 'sr-only' : ''}>{t('admin.signOut')}</span></button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-[var(--ns-z-header)] flex h-16 shrink-0 items-center gap-3 border-b border-[var(--ns-border-subtle)] bg-[var(--ns-bg-elevated)] px-4 sm:px-6" data-testid="admin-topbar">
          <AdminGlobalSearch />
          <LanguageSwitcher variant="select" />
          <span className="hidden text-xs font-semibold text-[var(--ns-text-muted)] sm:block">{t(`admin.statusValues.${user.role}`, { defaultValue: user.role })}</span>
        </header>
        <div className={`flex min-h-7 shrink-0 items-center border-b px-4 text-ns-meta font-semibold uppercase tracking-ns-label sm:px-6 ${adminEnvironment.isDemo ? 'border-amber-500/30 bg-amber-500/8 text-amber-300' : 'border-[var(--ns-border-subtle)] bg-[var(--ns-card-soft)] text-[var(--ns-text-muted)]'}`} data-testid="admin-environment-bar">
          {t(`admin.environment.${adminEnvironment.mode.toLowerCase()}`)}{adminEnvironment.isDemo && <><span aria-hidden="true" className="mx-2">·</span>{t('admin.environment.demoDetail')}</>}
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden" data-testid="admin-main">
          <div className="mx-auto w-full max-w-[112rem] space-y-5 p-4 sm:p-6 lg:p-7"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return <AdminAccessGuard><AdminShell /></AdminAccessGuard>;
}
