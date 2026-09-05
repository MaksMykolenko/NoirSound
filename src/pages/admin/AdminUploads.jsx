import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cancelUpload, getAdminUploads, retryUpload } from '../../api/admin';
import { useToastStore } from '../../store/toastStore';
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
  ConfirmActionModal,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { formatAdminDate, useAdminData } from '../../components/admin/adminUtils';
import useAdminListUrlState from './useAdminListUrlState';

function sizeLabel(bytes, unavailable, locale) {
  if (!Number.isFinite(bytes)) return unavailable;
  return new Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

export default function AdminUploads() {
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const { value, page, setFilter, setPage } = useAdminListUrlState();
  const search = value('search');
  const status = value('status');
  const [pending, setPending] = useState(null);
  const { data, loading, error, reload } = useAdminData(
    () => getAdminUploads({ search, status, page }),
    [search, status, page]
  );

  async function confirm(reason) {
    try {
      await (pending.action === 'retry' ? retryUpload(pending.id, reason) : cancelUpload(pending.id, reason));
      addToast(t('admin.actionCompleted'), 'success');
      reload();
    } catch (actionError) {
      addToast(t('admin.actionFailed'), 'error');
      throw actionError;
    }
  }

  return (
    <>
      <AdminPageHeader title={t('admin.uploads')} description={t('admin.uploadsDescription')} />
      <AdminPanel>
        <AdminSearch value={search} onChange={(nextValue) => setFilter('search', nextValue)} placeholder={t('admin.searchUploads')}>
          <AdminSelect
            label={t('admin.status')}
            value={status}
            onChange={(nextValue) => setFilter('status', nextValue)}
            options={[
              ['', t('admin.allStatuses')],
              ...['FAILED', 'PROCESSING', 'READY', 'UPLOADING', 'INITIATED', 'CANCELLED'].map((value) => [value, t(`admin.statusValues.${value}`)]),
            ]}
          />
        </AdminSearch>
        {loading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={reload} /> : !data?.data?.length ? (
          <AdminEmpty text={t('admin.noUploadsFound')} />
        ) : (
          <AdminTable>
            <thead><tr>
              {[t('admin.file'), t('admin.user'), t('admin.track'), t('admin.mime'), t('admin.size'), t('admin.status'), t('admin.updated'), t('admin.actions')].map((label) => <AdminTableHead key={label}>{label}</AdminTableHead>)}
            </tr></thead>
            <tbody>{data.data.map((upload) => (
              <tr key={upload.id} className="border-t border-[var(--ns-border-subtle)]">
                <td className="px-4 py-3 text-sm font-semibold">{upload.originalFileName}</td>
                <td className="px-4 py-3 text-sm">@{upload.user?.username}</td>
                <td className="px-4 py-3 text-sm">{upload.track ? <Link to={`/admin/tracks/${upload.track.id}`} className="text-[var(--ns-accent-text)]">{upload.track.title}</Link> : '—'}</td>
                <td className="px-4 py-3 text-sm text-[var(--ns-text-muted)]">{upload.mimeType || '—'}</td>
                <td className="px-4 py-3 text-sm tabular-nums">{sizeLabel(upload.sizeBytes, t('admin.unavailable'), i18n.language)}</td>
                <td className="px-4 py-3"><StatusBadge status={upload.status} /></td>
                <td className="px-4 py-3 text-sm text-[var(--ns-text-muted)]">{formatAdminDate(upload.updatedAt, i18n.language)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {upload.status === 'FAILED' && <button type="button" onClick={() => setPending({ id: upload.id, action: 'retry' })} aria-label={`${t('admin.retry')}: ${upload.originalFileName || upload.id}`} className="ns-button-secondary rounded px-3 py-2 text-sm"><span aria-hidden="true">{t('admin.retry')}</span></button>}
                    {['INITIATED', 'UPLOADING', 'FAILED'].includes(upload.status) && <button type="button" onClick={() => setPending({ id: upload.id, action: 'cancel' })} aria-label={`${t('admin.cancel')}: ${upload.originalFileName || upload.id}`} className="ns-button-secondary rounded px-3 py-2 text-sm"><span aria-hidden="true">{t('admin.cancel')}</span></button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </AdminTable>
        )}
        <AdminPagination pagination={data?.pagination} onPage={setPage} />
      </AdminPanel>
      <ConfirmActionModal open={Boolean(pending)} onClose={() => setPending(null)} onConfirm={confirm} actionLabel={pending?.action === 'retry' ? t('admin.retry') : t('admin.cancel')} />
    </>
  );
}
