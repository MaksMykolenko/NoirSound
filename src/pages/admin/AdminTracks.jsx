import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { getAdminTracks } from '../../api/admin';
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

export default function AdminTracks() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminData(
    () => getAdminTracks({ search, status, page }),
    [search, status, page]
  );

  return (
    <>
      <AdminPageHeader title={t('admin.tracks')} description={t('admin.tracksDescription')} />
      <AdminPanel>
        <AdminSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t('admin.searchTracks')}>
          <AdminSelect
            label={t('admin.status')}
            value={status}
            onChange={(value) => { setStatus(value); setPage(1); }}
            options={[
              ['', t('admin.allStatuses')],
              ...['PUBLISHED', 'HIDDEN', 'FAILED', 'PROCESSING', 'REJECTED', 'PENDING_REVIEW', 'DRAFT'].map((value) => [value, t(`admin.statusValues.${value}`)]),
            ]}
          />
        </AdminSearch>
        {loading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={reload} /> : !data?.data?.length ? (
          <AdminEmpty text={t('admin.noTracksFound')} />
        ) : (
          <AdminTable>
            <thead><tr>
              {[t('admin.track'), t('admin.artist'), t('admin.genre'), t('admin.status'), t('admin.plays'), t('admin.reports'), t('admin.updated'), t('admin.actions')].map((label) => (
                <AdminTableHead key={label}>{label}</AdminTableHead>
              ))}
            </tr></thead>
            <tbody>{data.data.map((track) => (
              <tr key={track.id} className="border-t border-[var(--ns-border-subtle)]">
                <td className="px-4 py-3 font-semibold">{track.title}</td>
                <td className="px-4 py-3 text-xs text-[var(--ns-text-secondary)]">{track.artist?.user?.displayName}</td>
                <td className="px-4 py-3 text-xs text-[var(--ns-text-muted)]">{track.genre || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={track.status} /></td>
                <td className="px-4 py-3">{track.plays}</td>
                <td className="px-4 py-3">{track.reportsCount}</td>
                <td className="px-4 py-3 text-xs text-[var(--ns-text-muted)]">{formatAdminDate(track.updatedAt, i18n.language)}</td>
                <td className="px-4 py-3">
                  <Link to={`/admin/tracks/${track.id}`} className="ns-button-secondary inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs">
                    <Eye className="h-3.5 w-3.5" /> {t('admin.view')}
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
