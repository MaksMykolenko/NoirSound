import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAdminArtists } from '../../api/admin';
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

export default function AdminArtists() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminData(
    () => getAdminArtists({ search, hidden, page }),
    [search, hidden, page]
  );

  return (
    <>
      <AdminPageHeader title={t('admin.artists')} description={t('admin.artistsDescription')} />
      <AdminPanel>
        <AdminSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t('admin.searchArtists')}>
          <AdminSelect
            label={t('admin.visibility')}
            value={hidden}
            onChange={(value) => { setHidden(value); setPage(1); }}
            options={[
              ['', t('admin.allStatuses')],
              ['false', t('admin.statusValues.VISIBLE')],
              ['true', t('admin.statusValues.HIDDEN')],
            ]}
          />
        </AdminSearch>
        {loading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={reload} /> : !data?.data?.length ? (
          <AdminEmpty text={t('admin.noArtistsFound')} />
        ) : (
          <AdminTable>
            <thead><tr>
              {[t('admin.artist'), t('admin.email'), t('admin.status'), t('admin.tracks'), t('admin.followers'), t('admin.updated'), t('admin.actions')].map((label) => <AdminTableHead key={label}>{label}</AdminTableHead>)}
            </tr></thead>
            <tbody>{data.data.map((artist) => (
              <tr key={artist.id} className="border-t border-[var(--ns-border-subtle)]">
                <td className="px-4 py-3"><div className="font-semibold">{artist.user?.displayName}</div><div className="text-xs text-[var(--ns-text-muted)]">@{artist.user?.username}</div></td>
                <td className="px-4 py-3 text-xs">{artist.user?.email}</td>
                <td className="px-4 py-3"><StatusBadge status={artist.isHidden ? 'HIDDEN' : artist.user?.status} /></td>
                <td className="px-4 py-3">{artist._count?.tracks ?? 0}</td>
                <td className="px-4 py-3">{artist._count?.followers ?? 0}</td>
                <td className="px-4 py-3 text-xs text-[var(--ns-text-muted)]">{formatAdminDate(artist.updatedAt, i18n.language)}</td>
                <td className="px-4 py-3"><Link to={`/admin/artists/${artist.id}`} className="ns-button-secondary rounded-lg px-3 py-2 text-xs">{t('admin.view')}</Link></td>
              </tr>
            ))}</tbody>
          </AdminTable>
        )}
        <AdminPagination pagination={data?.pagination} onPage={setPage} />
      </AdminPanel>
    </>
  );
}
