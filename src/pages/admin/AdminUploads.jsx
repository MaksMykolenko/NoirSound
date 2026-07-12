import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

function sizeLabel(bytes, unavailable) {
  if (!Number.isFinite(bytes)) return unavailable;
  return new Intl.NumberFormat(undefined, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

export default function AdminUploads() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const addToast = useToastStore((state) => state.addToast);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(1);
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
        <AdminSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t('admin.searchUploads')}>
          <AdminSelect
            label={t('admin.status')}
            value={status}
            onChange={(value) => { setStatus(value); setPage(1); }}
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
                <td className="px-4 py-3 text-xs font-semibold">{upload.originalFileName}</td>
                <td className="px-4 py-3 text-xs">@{upload.user?.username}</td>
                <td className="px-4 py-3 text-xs">{upload.track ? <Link to={`/admin/tracks/${upload.track.id}`} className="text-[var(--ns-accent-text)]">{upload.track.title}</Link> : '—'}</td>
                <td className="px-4 py-3 text-xs text-[var(--ns-text-muted)]">{upload.mimeType || '—'}</td>
                <td className="px-4 py-3 text-xs">{sizeLabel(upload.sizeBytes, t('admin.unavailable'))}</td>
                <td className="px-4 py-3"><StatusBadge status={upload.status} /></td>
                <td className="px-4 py-3 text-xs text-[var(--ns-text-muted)]">{formatAdminDate(upload.updatedAt, i18n.language)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {upload.status === 'FAILED' && <button type="button" onClick={() => setPending({ id: upload.id, action: 'retry' })} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.retry')}</button>}
                    {['INITIATED', 'UPLOADING', 'FAILED'].includes(upload.status) && <button type="button" onClick={() => setPending({ id: upload.id, action: 'cancel' })} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.cancel')}</button>}
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
