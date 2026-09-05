import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { getAdminReports } from '../../api/admin';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  AdminSearch,
  AdminSelect,
  AdminTable,
  AdminTableHead,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { formatAdminDate, useAdminData } from '../../components/admin/adminUtils';
import useAdminListUrlState from './useAdminListUrlState';

export default function AdminReports() {
  const { t, i18n } = useTranslation();
  const { value, page, setFilter, setPage } = useAdminListUrlState({ status: 'OPEN' });
  const status = value('status');
  const targetType = value('targetType');
  const reason = value('reason');
  const { data, loading, error, reload } = useAdminData(
    () => getAdminReports({ status, targetType, reason, page }),
    [status, targetType, reason, page]
  );

  return (
    <>
      <AdminPageHeader title={t('admin.reports')} description={t('admin.reportsDescription')} />
      <AdminPanel>
        <AdminSearch value={reason} onChange={(nextValue) => setFilter('reason', nextValue)} placeholder={t('admin.filterReason')}>
          <AdminSelect
            label={t('admin.status')}
            value={status}
            onChange={(nextValue) => setFilter('status', nextValue)}
            options={[
              ['', t('admin.allStatuses')],
              ...['OPEN', 'ESCALATED', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'].map((value) => [value, t(`admin.statusValues.${value}`)]),
            ]}
          />
          <AdminSelect
            label={t('admin.targetType')}
            value={targetType}
            onChange={(nextValue) => setFilter('targetType', nextValue)}
            options={[
              ['', t('admin.allTargetTypes')],
              ...['TRACK', 'COMMENT', 'USER', 'ARTIST', 'PLAYLIST'].map((value) => [value, t(`admin.statusValues.${value}`)]),
            ]}
          />
        </AdminSearch>
        {loading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={reload} /> : !data?.data?.length ? (
          <AdminEmpty text={t('admin.noReportsYet')} />
        ) : (
          <AdminTable>
            <thead><tr>
              {[t('admin.reason'), t('admin.targetType'), t('admin.reporter'), t('admin.status'), t('admin.created'), t('admin.actions')].map((label) => (
                <AdminTableHead key={label}>{label}</AdminTableHead>
              ))}
            </tr></thead>
            <tbody>{data.data.map((report) => (
              <tr key={report.id} className="border-t border-[var(--ns-border-subtle)]">
                <td className="px-4 py-3 font-semibold">{t(`admin.statusValues.${report.reason}`, { defaultValue: report.reason })}</td>
                <td className="px-4 py-3"><StatusBadge status={report.targetType} /></td>
                <td className="px-4 py-3 text-sm text-[var(--ns-text-secondary)]">@{report.reporter?.username}</td>
                <td className="px-4 py-3"><StatusBadge status={report.status} /></td>
                <td className="px-4 py-3 text-sm text-[var(--ns-text-muted)]">{formatAdminDate(report.createdAt, i18n.language)}</td>
                <td className="px-4 py-3">
                  <Link to={`/admin/reports/${report.id}`} aria-label={`${t('admin.review')}: ${report.id}`} className="ns-button-secondary inline-flex items-center gap-1 rounded px-3 py-2 text-sm">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> <span aria-hidden="true">{t('admin.review')}</span>
                  </Link>
                </td>
              </tr>
            ))}</tbody>
          </AdminTable>
        )}
        <AdminPagination pagination={data?.pagination} onPage={setPage} />
      </AdminPanel>
    </>
  );
}
