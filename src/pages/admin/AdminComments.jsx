import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAdminComments, hideComment, unhideComment } from '../../api/admin';
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

export default function AdminComments() {
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const { value, page, setFilter, setPage } = useAdminListUrlState();
  const search = value('search');
  const status = value('status');
  const [pending, setPending] = useState(null);
  const { data, loading, error, reload } = useAdminData(
    () => getAdminComments({ search, status, page }),
    [search, status, page]
  );

  async function confirm(reason) {
    try {
      await (pending.hidden ? unhideComment(pending.id, reason) : hideComment(pending.id, reason));
      addToast(t('admin.actionCompleted'), 'success');
      reload();
    } catch (actionError) {
      addToast(t('admin.actionFailed'), 'error');
      throw actionError;
    }
  }

  return (
    <>
      <AdminPageHeader title={t('admin.comments')} description={t('admin.commentsDescription')} />
      <AdminPanel>
        <AdminSearch value={search} onChange={(nextValue) => setFilter('search', nextValue)} placeholder={t('admin.searchComments')}>
          <AdminSelect
            label={t('admin.status')}
            value={status}
            onChange={(nextValue) => setFilter('status', nextValue)}
            options={[
              ['', t('admin.allStatuses')],
              ['VISIBLE', t('admin.statusValues.VISIBLE')],
              ['HIDDEN', t('admin.statusValues.HIDDEN')],
            ]}
          />
        </AdminSearch>
        {loading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={reload} /> : !data?.data?.length ? (
          <AdminEmpty text={t('admin.noCommentsFound')} />
        ) : (
          <AdminTable>
            <thead><tr>
              {[t('admin.comment'), t('admin.user'), t('admin.track'), t('admin.status'), t('admin.reports'), t('admin.created'), t('admin.actions')].map((label) => <AdminTableHead key={label}>{label}</AdminTableHead>)}
            </tr></thead>
            <tbody>{data.data.map((comment) => (
              <tr key={comment.id} className="border-t border-[var(--ns-border-subtle)]">
                <td className="max-w-xs px-4 py-3 text-sm"><span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{comment.text}</span></td>
                <td className="px-4 py-3 text-sm">@{comment.user?.username}</td>
                <td className="px-4 py-3 text-sm"><Link to={`/admin/tracks/${comment.trackId}`} className="text-[var(--ns-accent-text)]">{comment.track?.title}</Link></td>
                <td className="px-4 py-3"><StatusBadge status={comment.isDeleted ? 'HIDDEN' : 'VISIBLE'} /></td>
                <td className="px-4 py-3">{comment.reportsCount}</td>
                <td className="px-4 py-3 text-sm text-[var(--ns-text-muted)]">{formatAdminDate(comment.createdAt, i18n.language)}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setPending({ id: comment.id, hidden: comment.isDeleted })} aria-label={`${comment.isDeleted ? t('admin.unhide') : t('admin.hide')}: ${comment.id}`} className="ns-button-secondary rounded px-3 py-2 text-sm">
                    <span aria-hidden="true">{comment.isDeleted ? t('admin.unhide') : t('admin.hide')}</span>
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </AdminTable>
        )}
        <AdminPagination pagination={data?.pagination} onPage={setPage} />
      </AdminPanel>
      <ConfirmActionModal open={Boolean(pending)} onClose={() => setPending(null)} onConfirm={confirm} actionLabel={pending?.hidden ? t('admin.unhide') : t('admin.hide')} />
    </>
  );
}
