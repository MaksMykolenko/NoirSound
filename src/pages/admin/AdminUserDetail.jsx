import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  banUser,
  getAdminUser,
  revokeUserSessions,
  setUserRole,
  suspendUser,
  unbanUser,
  unsuspendUser,
} from '../../api/admin';
import { useToastStore } from '../../store/toastStore';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  ConfirmActionModal,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { formatAdminDate, useAdminData } from '../../components/admin/adminUtils';

export default function AdminUserDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const { data, loading, error, reload } = useAdminData(() => getAdminUser(id), [id]);
  const [pendingAction, setPendingAction] = useState(null);
  const [role, setRole] = useState('');

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} onRetry={reload} />;
  const user = data?.user;
  if (!user) return <AdminEmpty text={t('admin.noUsersFound')} />;

  const actions = {
    suspend: (reason) => suspendUser(id, reason),
    unsuspend: (reason) => unsuspendUser(id, reason),
    ban: (reason) => banUser(id, reason),
    unban: (reason) => unbanUser(id, reason),
    revoke: (reason) => revokeUserSessions(id, reason),
    role: (reason) => setUserRole(id, role, reason),
  };

  async function confirm(reason) {
    try {
      await actions[pendingAction](reason);
      addToast(t('admin.actionCompleted'), 'success');
      reload();
    } catch (actionError) {
      addToast(t('admin.actionFailed'), 'error');
      throw actionError;
    }
  }

  return (
    <>
      <AdminPageHeader
        title={user.displayName}
        description={`@${user.username}`}
        actions={<Link to="/admin/users" className="ns-button-secondary rounded-xl px-3 py-2 text-xs">{t('admin.backToUsers')}</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <AdminPanel className="p-4 lg:col-span-2">
          <h2 className="text-sm font-bold">{t('admin.accountInfo')}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              [t('admin.email'), user.email],
              [t('admin.role'), <StatusBadge key="role" status={user.role} />],
              [t('admin.status'), <StatusBadge key="status" status={user.status} />],
              [t('admin.joined'), formatAdminDate(user.joinedAt, i18n.language)],
              [t('admin.updated'), formatAdminDate(user.updatedAt, i18n.language)],
              [t('admin.sessions'), user.sessions?.active ?? 0],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--ns-text-muted)]">{label}</dt>
                <dd className="mt-1 text-sm text-[var(--ns-text-secondary)]">{value}</dd>
              </div>
            ))}
          </dl>
        </AdminPanel>
        <AdminPanel className="p-4">
          <h2 className="text-sm font-bold">{t('admin.activitySummary')}</h2>
          <dl className="mt-4 space-y-3">
            {Object.entries(user.counts || {}).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <dt className="text-[var(--ns-text-muted)]">{t(`admin.${key}`, { defaultValue: key })}</dt>
                <dd className="font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </AdminPanel>
      </div>
      <AdminPanel className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('admin.tracks')}</h2>
        {!user.artistProfile?.tracks?.length ? <AdminEmpty text={t('admin.noTracksFound')} /> : (
          <div className="space-y-2">
            {user.artistProfile.tracks.map((track) => (
              <Link key={track.id} to={`/admin/tracks/${track.id}`} className="flex items-center justify-between rounded-xl bg-[var(--ns-card-soft)] p-3 text-sm">
                <span>{track.title}</span><StatusBadge status={track.status} />
              </Link>
            ))}
          </div>
        )}
      </AdminPanel>
      <AdminPanel className="border-[color-mix(in_srgb,var(--ns-danger)_35%,transparent)] p-4">
        <h2 className="text-sm font-bold text-[var(--ns-danger)]">{t('admin.dangerZone')}</h2>
        <p className="mt-1 text-xs text-[var(--ns-text-muted)]">{t('admin.dangerZoneDescription')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {user.status === 'ACTIVE' && (
            <>
              <button type="button" onClick={() => setPendingAction('suspend')} className="ns-button-secondary rounded-lg px-3 py-2 text-xs">{t('admin.suspend')}</button>
              <button type="button" onClick={() => setPendingAction('ban')} className="rounded-lg bg-[var(--ns-danger)] px-3 py-2 text-xs font-bold text-white">{t('admin.ban')}</button>
            </>
          )}
          {user.status === 'SUSPENDED' && <button type="button" onClick={() => setPendingAction('unsuspend')} className="ns-button-secondary rounded-lg px-3 py-2 text-xs">{t('admin.unsuspend')}</button>}
          {user.status === 'BANNED' && <button type="button" onClick={() => setPendingAction('unban')} className="ns-button-secondary rounded-lg px-3 py-2 text-xs">{t('admin.unban')}</button>}
          <button type="button" onClick={() => setPendingAction('revoke')} className="ns-button-secondary rounded-lg px-3 py-2 text-xs">{t('admin.revokeSessions')}</button>
          <select value={role} onChange={(event) => setRole(event.target.value)} className="ns-field rounded-lg px-3 py-2 text-xs">
            <option value="">{t('admin.selectRole')}</option>
            {['LISTENER', 'ARTIST', 'ADMIN'].map((value) => <option key={value} value={value}>{t(`admin.statusValues.${value}`)}</option>)}
          </select>
          <button type="button" disabled={!role || role === user.role} onClick={() => setPendingAction('role')} className="ns-button-secondary rounded-lg px-3 py-2 text-xs disabled:opacity-40">
            {t('admin.setRole')}
          </button>
        </div>
      </AdminPanel>
      <AdminPanel className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('admin.auditHistory')}</h2>
        {!data.audit?.length ? <AdminEmpty text={t('admin.noAuditEntries')} /> : data.audit.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center gap-2 border-t border-[var(--ns-border-subtle)] py-3 text-xs first:border-0">
            <StatusBadge status={entry.action} />
            <span className="text-[var(--ns-text-muted)]">{entry.actor?.username}</span>
            <span className="ml-auto text-[var(--ns-text-muted)]">{formatAdminDate(entry.createdAt, i18n.language)}</span>
          </div>
        ))}
      </AdminPanel>
      <ConfirmActionModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={confirm}
        title={t('admin.confirmAction')}
        actionLabel={t('admin.confirm')}
      />
    </>
  );
}
