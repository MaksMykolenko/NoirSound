import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { getAdminUsers } from '../../api/admin';
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

function ArtistProfileCell({ t, user }) {
  if (!user.hasArtistProfile) {
    const label = user.role === 'LISTENER'
      ? t('admin.artistAccess.noArtistAccess')
      : t('admin.artistAccess.profileMissingShort');
    return <span className="text-sm font-semibold text-[var(--ns-text-muted)]">{label}</span>;
  }
  if (user.artistProfileHidden) {
    return <span className="text-sm font-semibold text-amber-400">{t('admin.artistAccess.profileHiddenShort')}</span>;
  }
  return <span className="text-sm font-semibold text-emerald-400">{t('admin.artistAccess.profileReadyShort')}</span>;
}

function UploadAccessCell({ t, user }) {
  return user.canUploadTracks
    ? <span className="text-sm font-semibold text-emerald-400">{t('admin.artistAccess.canUploadShort')}</span>
    : <span className="text-sm font-semibold text-amber-400">{t('admin.artistAccess.uploadBlockedShort')}</span>;
}

export default function AdminUsers() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState(searchParams.get('role') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [hasArtistProfile, setHasArtistProfile] = useState(searchParams.get('hasArtistProfile') || '');
  const [uploadBlocked, setUploadBlocked] = useState(searchParams.get('uploadBlocked') || '');
  const [page, setPage] = useState(1);
  const query = { search, role, status, hasArtistProfile, uploadBlocked, page };
  const { data, loading, error, reload } = useAdminData(
    () => getAdminUsers(query),
    [search, role, status, hasArtistProfile, uploadBlocked, page]
  );

  return (
    <>
      <AdminPageHeader title={t('admin.users')} description={t('admin.usersDescription')} />
      <AdminPanel>
        <AdminSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t('admin.searchUsers')}>
          <AdminSelect
            label={t('admin.role')}
            value={role}
            onChange={(value) => { setRole(value); setPage(1); }}
            options={[
              ['', t('admin.allRoles')],
              ['ADMIN', t('admin.statusValues.ADMIN')],
              ['ARTIST', t('admin.statusValues.ARTIST')],
              ['LISTENER', t('admin.statusValues.LISTENER')],
            ]}
          />
          <AdminSelect
            label={t('admin.status')}
            value={status}
            onChange={(value) => { setStatus(value); setPage(1); }}
            options={[
              ['', t('admin.allStatuses')],
              ['ACTIVE', t('admin.statusValues.ACTIVE')],
              ['SUSPENDED', t('admin.statusValues.SUSPENDED')],
              ['BANNED', t('admin.statusValues.BANNED')],
              ['DELETED', t('admin.statusValues.DELETED')],
            ]}
          />
          <AdminSelect
            label={t('admin.artistAccess.filterProfile')}
            value={hasArtistProfile}
            onChange={(value) => { setHasArtistProfile(value); setPage(1); }}
            options={[
              ['', t('admin.artistAccess.filterProfileAll')],
              ['true', t('admin.artistAccess.filterProfileHas')],
              ['false', t('admin.artistAccess.filterProfileMissing')],
            ]}
          />
          <AdminSelect
            label={t('admin.artistAccess.filterUpload')}
            value={uploadBlocked}
            onChange={(value) => { setUploadBlocked(value); setPage(1); }}
            options={[
              ['', t('admin.artistAccess.filterUploadAll')],
              ['false', t('admin.artistAccess.filterUploadCan')],
              ['true', t('admin.artistAccess.filterUploadBlocked')],
            ]}
          />
        </AdminSearch>
        {loading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={reload} /> : !data?.data?.length ? (
          <AdminEmpty text={t('admin.noUsersFound')} />
        ) : (
          <AdminTable>
            <thead><tr>
              {[
                t('admin.user'),
                t('admin.email'),
                t('admin.role'),
                t('admin.status'),
                t('admin.artistAccess.columnProfile'),
                t('admin.artistAccess.columnUpload'),
                t('admin.joinedUpdated'),
                t('admin.tracks'),
                t('admin.reports'),
                t('admin.actions'),
              ].map((label) => (
                <AdminTableHead key={label}>{label}</AdminTableHead>
              ))}
            </tr></thead>
            <tbody>
              {data.data.map((user) => (
                <tr key={user.id} className="border-t border-[var(--ns-border-subtle)]">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{user.displayName}</div>
                    <div className="text-sm text-[var(--ns-text-muted)]">@{user.username}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--ns-text-secondary)]">{user.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={user.role} /></td>
                  <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                  <td className="px-4 py-3"><ArtistProfileCell t={t} user={user} /></td>
                  <td className="px-4 py-3"><UploadAccessCell t={t} user={user} /></td>
                  <td className="px-4 py-3 text-sm text-[var(--ns-text-muted)]">{formatAdminDate(user.updatedAt || user.joinedAt, i18n.language)}</td>
                  <td className="px-4 py-3">{user.counts?.tracks ?? 0}</td>
                  <td className="px-4 py-3">{user.counts?.reports ?? 0}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/users/${user.id}`} className="ns-button-secondary inline-flex items-center gap-1 rounded px-3 py-2 text-sm">
                      <Eye className="h-3.5 w-3.5" /> {t('admin.view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
        <AdminPagination pagination={data?.pagination} onPage={setPage} />
      </AdminPanel>
    </>
  );
}
