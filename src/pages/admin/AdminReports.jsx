import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

export default function AdminReports() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || 'OPEN');
  const [targetType, setTargetType] = useState(searchParams.get('targetType') || '');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminData(
    () => getAdminReports({ status, targetType, reason, page }),
    [status, targetType, reason, page]
  );

  return (
    <>
      <AdminPageHeader title={t('admin.reports')} description={t('admin.reportsDescription')} />
      <AdminPanel>
        <AdminSearch value={reason} onChange={(value) => { setReason(value); setPage(1); }} placeholder={t('admin.filterReason')}>
          <AdminSelect
            label={t('admin.status')}
            value={status}
            onChange={(value) => { setStatus(value); setPage(1); }}
            options={[
              ['', t('admin.allStatuses')],
              ...['OPEN', 'ESCALATED', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'].map((value) => [value, t(`admin.statusValues.${value}`)]),
            ]}
          />
          <AdminSelect
            label={t('admin.targetType')}
            value={targetType}
            onChange={(value) => { setTargetType(value); setPage(1); }}
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
                <td className="px-4 py-3 text-xs text-[var(--ns-text-secondary)]">@{report.reporter?.username}</td>
                <td className="px-4 py-3"><StatusBadge status={report.status} /></td>
                <td className="px-4 py-3 text-xs text-[var(--ns-text-muted)]">{formatAdminDate(report.createdAt, i18n.language)}</td>
                <td className="px-4 py-3">
                  <Link to={`/admin/reports/${report.id}`} className="ns-button-secondary inline-flex items-center gap-1 rounded px-3 py-2 text-xs">
                    <Eye className="h-3.5 w-3.5" /> {t('admin.review')}
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
