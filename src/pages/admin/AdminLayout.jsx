import React from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  BarChart3,
  Flag,
  Gauge,
  HardDriveUpload,
  MessageSquare,
  Music2,
  ScrollText,
  Settings,
  ShieldAlert,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { AdminLoading } from '../../components/admin/AdminUI';

export default function AdminLayout() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const authHydrated = useUserStore((state) => state.authHydrated);
  const setAuthModalOpen = useUserStore((state) => state.setAuthModalOpen);

  if (!authHydrated) return <AdminLoading />;
  if (!user) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-[var(--ns-accent)]" />
        <h1 className="mt-4 font-display text-xl font-bold">{t('admin.signInRequired')}</h1>
        <p className="mt-2 text-sm text-[var(--ns-text-muted)]">{t('admin.signInRequiredDescription')}</p>
        <button type="button" onClick={() => setAuthModalOpen(true)} className="ns-button-primary mt-5 !rounded px-5 py-2.5 text-sm">
          {t('header.signIn')}
        </button>
      </div>
    );
  }
  if (user.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-lg py-16 text-center" data-testid="admin-access-denied">
        <ShieldAlert className="mx-auto h-10 w-10 text-[var(--ns-danger)]" />
        <h1 className="mt-4 font-display text-xl font-bold">{t('admin.accessDenied')}</h1>
        <p className="mt-2 text-sm text-[var(--ns-text-muted)]">{t('admin.adminOnly')}</p>
      </div>
    );
  }

  const links = [
    ['overview', 'overview', Gauge],
    ['reports', 'reports', Flag],
    ['users', 'users', UsersRound],
    ['tracks', 'tracks', Music2],
    ['artists', 'artists', UserRound],
    ['comments', 'comments', MessageSquare],
    ['uploads', 'uploads', HardDriveUpload],
    ['audit-logs', 'auditLogs', ScrollText],
    ['system', 'system', Activity],
    ['system/stats', 'statsIntegrity.navLabel', BarChart3],
    ['settings', 'settings', Settings],
  ];

  return (
    <div className="flex min-h-[65vh] flex-col gap-4 [&_.ns-button-primary]:!rounded [&_.ns-button-secondary]:!rounded [&_.ns-field]:!rounded [&_.ns-icon-button]:!rounded xl:flex-row">
      <aside className="xl:w-56 xl:shrink-0">
        <div className="sticky top-0 rounded-md border border-[var(--ns-border-subtle)] bg-[color-mix(in_srgb,var(--ns-surface)_78%,transparent)] p-2">
          <div className="mb-2 flex items-center gap-2 border-b border-[var(--ns-border-subtle)] px-2 py-2">
            <ShieldAlert className="h-5 w-5 text-[var(--ns-accent)]" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em]">{t('admin.admin')}</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">
            {links.map(([path, key, Icon]) => (
              <NavLink
                key={path}
                to={`/admin/${path}`}
                className={({ isActive }) => `flex min-h-10 shrink-0 items-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--ns-accent-soft)] text-[var(--ns-accent-text)]'
                    : 'text-[var(--ns-text-muted)] hover:bg-[var(--ns-hover-bg)] hover:text-[var(--ns-text)]'
                }`}
              >
                <Icon className="h-4 w-4" /> {t(`admin.${key}`)}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1 space-y-4">
        <Outlet />
      </div>
    </div>
  );
}

export function AdminIndexRedirect() {
  return <Navigate to="/admin/overview" replace />;
}
