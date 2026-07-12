import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Flag, HardDriveUpload, Music2, ScrollText, UsersRound } from 'lucide-react';
import { getAdminOverview } from '../../api/admin';
import {
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { useAdminData } from '../../components/admin/adminUtils';

function valueOrUnavailable(value, unavailable) {
  return Number.isFinite(value) ? value.toLocaleString() : unavailable;
}

export default function AdminOverview() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useAdminData(getAdminOverview);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} onRetry={reload} />;

  const stats = [
    [t('admin.pendingReports'), data?.reports?.pending, Flag, '/admin/reports?status=OPEN'],
    [t('admin.failedUploads'), data?.uploads?.failed, AlertTriangle, '/admin/uploads?status=FAILED'],
    [t('admin.processingUploads'), data?.uploads?.processing, HardDriveUpload, '/admin/uploads?status=PROCESSING'],
    [t('admin.publishedTracks'), data?.tracks?.published, Music2, '/admin/tracks?status=PUBLISHED'],
    [t('admin.hiddenTracks'), data?.tracks?.hidden, Music2, '/admin/tracks?status=HIDDEN'],
    [t('admin.activeUsers'), data?.users?.active, UsersRound, '/admin/users?status=ACTIVE'],
    [t('admin.restrictedUsers'), (data?.users?.suspended ?? 0) + (data?.users?.banned ?? 0), UsersRound, '/admin/users'],
    [t('admin.commentsToday'), data?.comments?.today, Flag, '/admin/comments'],
    [t('admin.playEventsToday'), data?.playEvents?.today, Music2, '/admin/system'],
  ];

  return (
    <>
      <AdminPageHeader title={t('admin.overview')} description={t('admin.overviewDescription')} />
      <AdminPanel className="grid overflow-hidden sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(([label, value, Icon, to]) => (
          <Link key={label} to={to} className="group border-b border-r border-[var(--ns-border-subtle)] transition-colors hover:bg-[var(--ns-hover-bg)]">
            <div className="h-full p-4">
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-[var(--ns-text-muted)]" />
                <span className="font-sans text-2xl font-bold">{valueOrUnavailable(value, t('admin.unavailable'))}</span>
              </div>
              <p className="mt-3 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-[var(--ns-text-muted)]">{label}</p>
            </div>
          </Link>
        ))}
      </AdminPanel>
      <AdminPanel className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold">{t('admin.systemStatus')}</h2>
          <StatusBadge status={data?.system?.status} />
        </div>
        <div className="divide-y divide-[var(--ns-border-subtle)] border-y border-[var(--ns-border-subtle)] sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-3">
          {['api', 'database', 'redis', 'storage', 'worker', 'ffmpeg'].map((name) => (
            <div key={name} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-sm font-semibold">{t(`admin.systemChecks.${name}`)}</span>
              <StatusBadge status={data?.system?.checks?.[name] || 'unavailable'} />
            </div>
          ))}
        </div>
      </AdminPanel>
      <AdminPanel className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('admin.quickActions')}</h2>
        <div className="flex flex-wrap gap-2">
          {[
            ['/admin/reports?status=OPEN', t('admin.viewPendingReports'), Flag],
            ['/admin/uploads?status=FAILED', t('admin.viewFailedUploads'), HardDriveUpload],
            ['/admin/users', t('admin.viewRecentUsers'), UsersRound],
            ['/admin/audit-logs', t('admin.viewAuditLogs'), ScrollText],
          ].map(([to, label, Icon]) => (
            <Link key={to} to={to} className="ns-button-secondary flex items-center gap-2 rounded px-3 py-2 text-sm">
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </div>
      </AdminPanel>
    </>
  );
}
