import React from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { formatAdminDate, formatAdminNumber, useAdminData } from '../../components/admin/adminUtils';
import { getGenreLabel } from '../../utils/genreLabels';
import AdminTrackDrawer from '../../components/admin/AdminTrackDrawer';

export default function AdminTracks() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const contentType = searchParams.get('contentType') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const selectedTrackId = searchParams.get('track');
  const updateParams = (patch) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value == null || (key === 'page' && Number(value) === 1)) next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    });
  };
  const { data, loading, error, reload } = useAdminData(
    () => getAdminTracks({ search, status, contentType, page }),
    [search, status, contentType, page]
  );

  return (
    <>
      <AdminPageHeader title={t('admin.tracks')} description={t('admin.tracksDescription')} />
      <AdminPanel>
        <AdminSearch value={search} onChange={(value) => updateParams({ q: value, page: 1 })} placeholder={t('admin.searchTracks')}>
          <AdminSelect
            label={t('admin.status')}
            value={status}
            onChange={(value) => updateParams({ status: value, page: 1 })}
            options={[
              ['', t('admin.allStatuses')],
              ...['PUBLISHED', 'HIDDEN', 'FAILED', 'PROCESSING', 'REJECTED', 'PENDING_REVIEW', 'DRAFT'].map((value) => [value, t(`admin.statusValues.${value}`)]),
            ]}
          />
          <AdminSelect
            label={t('admin.contentType')}
            value={contentType}
            onChange={(value) => updateParams({ contentType: value, page: 1 })}
            options={[
              ['', t('content.all')],
              ['MUSIC', t('content.music')],
              ['BEAT', t('content.beats')],
            ]}
          />
        </AdminSearch>
        {loading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={reload} /> : !data?.data?.length ? (
          <AdminEmpty text={t('admin.noTracksFound')} />
        ) : (
          <AdminTable>
            <thead><tr>
              {[t('admin.track'), t('admin.artist'), t('admin.contentType'), t('admin.genre'), t('admin.status'), t('admin.plays'), t('admin.reports'), t('admin.updated'), t('admin.actions')].map((label) => (
                <AdminTableHead key={label}>{label}</AdminTableHead>
              ))}
            </tr></thead>
            <tbody>{data.data.map((track) => (
              <tr key={track.id} className="border-t border-[var(--ns-border-subtle)]">
                <td className="px-4 py-3 font-semibold">
                  <span className="block max-w-[18rem] break-words">{track.title}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--ns-text-secondary)]">
                  <span className="block max-w-[14rem] break-words">{track.artist?.user?.displayName}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="ns-badge ns-status-neutral">{track.contentType === 'BEAT' ? t('content.beat') : t('content.music')}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--ns-text-muted)]">{track.genre ? getGenreLabel(track.genre) : '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={track.status} /></td>
                <td className="px-4 py-3 tabular-nums">{formatAdminNumber(track.plays, i18n.language)}</td>
                <td className="px-4 py-3 tabular-nums">{formatAdminNumber(track.reportsCount, i18n.language)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--ns-text-muted)]">{formatAdminDate(track.updatedAt, i18n.language)}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => updateParams({ track: track.id })} aria-label={`${t('admin.view')}: ${track.title}`} className="ns-button-secondary inline-flex items-center gap-1 rounded px-3 py-2 text-sm">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> <span aria-hidden="true">{t('admin.view')}</span>
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </AdminTable>
        )}
        <AdminPagination pagination={data?.pagination} onPage={(nextPage) => updateParams({ page: nextPage })} />
      </AdminPanel>
      {selectedTrackId && (
        <AdminTrackDrawer
          trackId={selectedTrackId}
          onClose={() => updateParams({ track: null })}
          onUpdated={reload}
        />
      )}
    </>
  );
}
