import React from 'react';
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
import { formatAdminDate, formatAdminNumber, useAdminData } from '../../components/admin/adminUtils';
import useAdminListUrlState from './useAdminListUrlState';

export default function AdminArtists() {
  const { t, i18n } = useTranslation();
  const { value, page, setFilter, setPage } = useAdminListUrlState();
  const search = value('search');
  const hidden = value('hidden');
  const { data, loading, error, reload } = useAdminData(
    () => getAdminArtists({ search, hidden, page }),
    [search, hidden, page]
  );

  return (
    <>
      <AdminPageHeader title={t('admin.artists')} description={t('admin.artistsDescription')} />
      <AdminPanel>
        <AdminSearch value={search} onChange={(nextValue) => setFilter('search', nextValue)} placeholder={t('admin.searchArtists')}>
          <AdminSelect
            label={t('admin.visibility')}
            value={hidden}
            onChange={(nextValue) => setFilter('hidden', nextValue)}
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
                <td className="px-4 py-3"><div className="font-semibold">{artist.user?.displayName}</div><div className="text-sm text-[var(--ns-text-muted)]">@{artist.user?.username}</div></td>
                <td className="px-4 py-3 text-sm">{artist.user?.email || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={artist.isHidden ? 'HIDDEN' : artist.user?.status} /></td>
                <td className="px-4 py-3 tabular-nums">{formatAdminNumber(artist._count?.tracks ?? 0, i18n.language)}</td>
                <td className="px-4 py-3 tabular-nums">{formatAdminNumber(artist._count?.followers ?? 0, i18n.language)}</td>
                <td className="px-4 py-3 text-sm text-[var(--ns-text-muted)]">{formatAdminDate(artist.updatedAt, i18n.language)}</td>
                <td className="px-4 py-3"><Link to={`/admin/artists/${artist.id}`} aria-label={`${t('admin.view')}: ${artist.user?.displayName || artist.user?.username || artist.id}`} className="ns-button-secondary rounded px-3 py-2 text-sm"><span aria-hidden="true">{t('admin.view')}</span></Link></td>
              </tr>
            ))}</tbody>
          </AdminTable>
        )}
        <AdminPagination pagination={data?.pagination} onPage={setPage} />
      </AdminPanel>
    </>
  );
}
