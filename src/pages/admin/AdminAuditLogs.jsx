import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuditLogs } from '../../api/admin';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  AdminSearch,
  AdminTable,
  AdminTableHead,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { formatAdminDate, useAdminData } from '../../components/admin/adminUtils';

export default function AdminAuditLogs() {
  const { t, i18n } = useTranslation();
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminData(
    () => getAuditLogs({ actor, page }),
    [actor, page]
  );

  return (
    <>
      <AdminPageHeader title={t('admin.auditLogs')} description={t('admin.auditLogsDescription')} />
      <AdminPanel>
        <AdminSearch value={actor} onChange={(value) => { setActor(value); setPage(1); }} placeholder={t('admin.searchAuditLogs')} />
        {loading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={reload} /> : !data?.data?.length ? (
          <AdminEmpty text={t('admin.noAuditEntries')} />
        ) : (
          <AdminTable>
            <thead><tr>
              {[t('admin.action'), t('admin.actor'), t('admin.targetType'), t('admin.targetId'), t('admin.reason'), t('admin.created')].map((label) => <AdminTableHead key={label}>{label}</AdminTableHead>)}
            </tr></thead>
            <tbody>{data.data.map((entry) => (
              <tr key={entry.id} className="border-t border-[var(--ns-border-subtle)]">
                <td className="px-4 py-3"><StatusBadge status={entry.action} /></td>
                <td className="px-4 py-3 text-sm">@{entry.actor?.username}</td>
                <td className="px-4 py-3"><StatusBadge status={entry.targetType} /></td>
                <td className="max-w-40 truncate px-4 py-3 font-mono text-ns-meta" title={entry.targetId}>{entry.targetId}</td>
                <td className="max-w-xs px-4 py-3 text-sm text-[var(--ns-text-muted)]">{entry.reason || '—'}</td>
                <td className="px-4 py-3 text-sm text-[var(--ns-text-muted)]">{formatAdminDate(entry.createdAt, i18n.language)}</td>
              </tr>
            ))}</tbody>
          </AdminTable>
        )}
        <AdminPagination pagination={data?.pagination} onPage={setPage} />
      </AdminPanel>
    </>
  );
}
