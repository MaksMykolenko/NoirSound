import React from 'react';
import { useTranslation } from 'react-i18next';
import { getAdminSystem } from '../../api/admin';
import {
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { useAdminData } from '../../components/admin/adminUtils';

export default function AdminSystem() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useAdminData(getAdminSystem);
  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} onRetry={reload} />;

  return (
    <>
      <AdminPageHeader title={t('admin.system')} description={t('admin.systemDescription')} />
      <AdminPanel className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{t('admin.readiness')}</h2>
          <StatusBadge status={data?.readiness?.status} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Object.entries(data?.readiness?.checks || {}).map(([name, status]) => (
            <div key={name} className="flex items-center justify-between rounded border border-[var(--ns-border-subtle)] bg-black/10 p-3">
              <span className="text-xs font-semibold">{t(`admin.systemChecks.${name}`, { defaultValue: name })}</span>
              <StatusBadge status={status} />
            </div>
          ))}
        </div>
      </AdminPanel>
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel className="p-4">
          <h2 className="text-sm font-bold">{t('admin.runtime')}</h2>
          <dl className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between"><dt className="text-[var(--ns-text-muted)]">{t('admin.version')}</dt><dd>{data?.version || t('admin.unavailable')}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--ns-text-muted)]">{t('admin.commit')}</dt><dd>{data?.commit || t('admin.unavailable')}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--ns-text-muted)]">{t('admin.uptime')}</dt><dd>{data?.uptimeSeconds ?? t('admin.unavailable')}</dd></div>
          </dl>
        </AdminPanel>
        <AdminPanel className="p-4">
          <h2 className="text-sm font-bold">{t('admin.safeConfiguration')}</h2>
          <dl className="mt-4 space-y-3 text-xs">
            {Object.entries(data?.config || {}).map(([name, status]) => (
              <div key={name} className="flex justify-between gap-4">
                <dt className="text-[var(--ns-text-muted)]">{t(`admin.configKeys.${name}`, { defaultValue: name })}</dt>
                <dd>{t(`admin.statusValues.${String(status).toUpperCase()}`, { defaultValue: status })}</dd>
              </div>
            ))}
          </dl>
        </AdminPanel>
      </div>
      <AdminPanel className="p-4">
        <h2 className="text-sm font-bold">{t('admin.queue')}</h2>
        {data?.queue?.counts ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            {Object.entries(data.queue.counts).map(([name, count]) => (
              <div key={name} className="rounded border border-[var(--ns-border-subtle)] bg-black/10 p-3 text-center">
                <div className="font-display text-xl font-bold">{count}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[var(--ns-text-muted)]">{t(`admin.queueStates.${name}`, { defaultValue: name })}</div>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-[var(--ns-text-muted)]">{t('admin.unavailable')}</p>}
      </AdminPanel>
    </>
  );
}
