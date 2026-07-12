import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { escalateReport, getAdminReport, rejectReport, resolveReport } from '../../api/admin';
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

export default function AdminReportDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const { data, loading, error, reload } = useAdminData(() => getAdminReport(id), [id]);
  const [pendingAction, setPendingAction] = useState(null);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} onRetry={reload} />;
  if (!data?.report) return <AdminEmpty text={t('admin.noReportsYet')} />;

  const report = data.report;
  const target = data.target;
  const isOpen = ['OPEN', 'ESCALATED'].includes(report.status);

  async function confirm(reason) {
    try {
      if (pendingAction === 'reject') await rejectReport(id, reason);
      else if (pendingAction === 'escalate') await escalateReport(id, reason);
      else {
        const targetAction = pendingAction === 'hide' ? 'HIDE_TARGET'
          : pendingAction === 'suspend' ? 'SUSPEND_USER'
            : 'NONE';
        await resolveReport(id, { notes: reason, targetAction });
      }
      addToast(t('admin.actionCompleted'), 'success');
      reload();
    } catch (actionError) {
      addToast(t('admin.actionFailed'), 'error');
      throw actionError;
    }
  }

  const targetAdminLink = report.targetType === 'TRACK'
    ? `/admin/tracks/${report.targetId}`
    : report.targetType === 'USER'
      ? `/admin/users/${report.targetId}`
      : report.targetType === 'ARTIST'
        ? `/admin/artists/${report.targetId}`
        : null;

  return (
    <>
      <AdminPageHeader
        title={t('admin.reportDetail')}
        description={report.id}
        actions={<Link to="/admin/reports" className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.backToReports')}</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <AdminPanel className="p-4 lg:col-span-2">
          <h2 className="text-sm font-bold">{t('admin.reportContext')}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              [t('admin.status'), <StatusBadge key="status" status={report.status} />],
              [t('admin.reason'), t(`admin.statusValues.${report.reason}`, { defaultValue: report.reason })],
              [t('admin.targetType'), <StatusBadge key="target-type" status={report.targetType} />],
              [t('admin.reporter'), report.reporter?.displayName || report.reporter?.username],
              [t('admin.created'), formatAdminDate(report.createdAt, i18n.language)],
              [t('admin.reviewed'), formatAdminDate(report.reviewedAt, i18n.language)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--ns-text-muted)]">{label}</dt>
                <dd className="mt-1 break-words text-sm text-[var(--ns-text-secondary)]">{value}</dd>
              </div>
            ))}
          </dl>
          {report.details && <p className="mt-5 rounded border border-[var(--ns-border-subtle)] bg-black/10 p-4 text-sm text-[var(--ns-text-secondary)]">{report.details}</p>}
        </AdminPanel>
        <AdminPanel className="p-4">
          <h2 className="text-sm font-bold">{t('admin.targetPreview')}</h2>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--ns-border-subtle)] bg-[var(--ns-input-bg)] p-3 text-xs text-[var(--ns-text-muted)]">
            {target ? JSON.stringify(target, null, 2) : t('admin.unavailable')}
          </pre>
          {targetAdminLink && <Link to={targetAdminLink} className="ns-button-secondary mt-3 block rounded px-3 py-2 text-center text-xs">{t('admin.openTarget')}</Link>}
        </AdminPanel>
      </div>
      {isOpen && (
        <AdminPanel className="p-4">
          <h2 className="text-sm font-bold">{t('admin.moderationActions')}</h2>
          <p className="mt-1 text-xs text-[var(--ns-text-muted)]">{t('admin.moderationActionsDescription')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setPendingAction('resolve')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.resolveOnly')}</button>
            <button type="button" onClick={() => setPendingAction('reject')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.rejectReport')}</button>
            {['TRACK', 'COMMENT', 'ARTIST'].includes(report.targetType) && <button type="button" onClick={() => setPendingAction('hide')} className="rounded bg-[var(--ns-danger)] px-3 py-2 text-xs font-semibold text-white">{t('admin.hideTargetResolve')}</button>}
            {['TRACK', 'COMMENT', 'USER', 'ARTIST'].includes(report.targetType) && <button type="button" onClick={() => setPendingAction('suspend')} className="rounded bg-[var(--ns-danger)] px-3 py-2 text-xs font-semibold text-white">{t('admin.suspendUserResolve')}</button>}
            {report.status === 'OPEN' && <button type="button" onClick={() => setPendingAction('escalate')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.escalate')}</button>}
          </div>
        </AdminPanel>
      )}
      <ConfirmActionModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={confirm}
        actionLabel={t('admin.confirm')}
        danger={['hide', 'suspend'].includes(pendingAction)}
      />
    </>
  );
}
