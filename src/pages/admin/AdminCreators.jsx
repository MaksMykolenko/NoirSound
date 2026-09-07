import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ExternalLink, MessageSquare, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import {
  getAdminCreators,
  getAdminCreatorsExportUrl,
  grantArtistAccess,
  revokeArtistAccess,
  updateCreatorStatus,
  updateCreatorNote,
} from '../../api/admin';
import {
  ConfirmActionModal,
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
import { useToastStore } from '../../store/toastStore';

export default function AdminCreators() {
  const { t } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const { value, page, setFilter, setPage } = useAdminListUrlState();

  const search = value('search');
  const creatorType = value('creatorType');
  const status = value('status');

  const [confirmModal, setConfirmModal] = useState(null);
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const query = { q: search, creatorType, status, page };
  const { data, loading, error, reload } = useAdminData(
    () => getAdminCreators(query),
    [search, creatorType, status, page]
  );

  const items = data?.items || [];
  // Real API counts cover all registrations; pagination describes the filtered
  // result. Keep the flat mock response compatible without counting one page as
  // the global summary or treating upload permission as registration status.
  const pagination = {
    page: data?.pagination?.page ?? data?.page ?? page,
    pageSize: data?.pagination?.limit ?? data?.pageSize ?? 50,
    total: data?.pagination?.total ?? data?.total ?? 0,
    totalPages: data?.pagination?.totalPages ?? data?.totalPages ?? 1,
  };
  const total = data?.counts?.TOTAL ?? pagination.total;
  const registeredCount = data?.counts?.REGISTERED ?? items.filter((item) => item.status === 'REGISTERED').length;
  const reviewedCount = data?.counts?.REVIEWED ?? items.filter((item) => item.status === 'REVIEWED').length;
  const enabledCount = data?.counts?.ENABLED ?? items.filter((item) => item.status === 'ENABLED').length;

  async function handleGrantAccess(creator, reason) {
    setActionLoading(true);
    try {
      await grantArtistAccess(creator.userId, { reason: reason || 'Admin approved creator registration' });
      await updateCreatorStatus(creator.id, { status: 'ENABLED' });
      addToast(t('admin.creators.grantSuccess') || `Artist access granted to @${creator.user.username}`, 'success');
      setConfirmModal(null);
      await reload();
    } catch (err) {
      addToast(err.message || 'Failed to grant artist access', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokeAccess(creator, reason) {
    setActionLoading(true);
    try {
      await revokeArtistAccess(creator.userId, { reason: reason || 'Admin revoked creator access' });
      addToast(t('admin.creators.revokeSuccess') || `Artist access revoked for @${creator.user.username}`, 'success');
      setConfirmModal(null);
      await reload();
    } catch (err) {
      addToast(err.message || 'Failed to revoke artist access', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatusChange(creator, newStatus) {
    try {
      await updateCreatorStatus(creator.id, { status: newStatus });
      addToast(t('admin.creators.statusUpdated') || `Status updated to ${newStatus}`, 'success');
      await reload();
    } catch (err) {
      addToast(err.message || 'Failed to update status', 'error');
    }
  }

  async function handleSaveNote() {
    if (!noteModal) return;
    setActionLoading(true);
    try {
      await updateCreatorNote(noteModal.id, { note: noteText });
      addToast(t('admin.creators.noteSaved') || 'Admin note saved', 'success');
      setNoteModal(null);
      await reload();
    } catch (err) {
      addToast(err.message || 'Failed to save note', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  const exportUrl = getAdminCreatorsExportUrl({
    q: search || undefined,
    creatorType: creatorType || undefined,
    status: status || undefined,
  });

  return (
    <>
      <AdminPageHeader
        title={t('admin.creators.title') || 'Creator Registrations'}
        description={t('admin.creators.description') || 'Review, evaluate, and enable access for creators registered via the landing page.'}
        actions={
          <a
            href={exportUrl}
            download
            className="ns-button-secondary inline-flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold"
          >
            <Download size={14} />
            <span>{t('admin.creators.exportCsv') || 'Export CSV'}</span>
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-[var(--ns-border-subtle)] p-3">
          <div className="text-xs text-[var(--ns-text-muted)]">{t('admin.creators.total') || 'Total Creators'}</div>
          <div className="mt-1 text-xl font-bold text-[var(--ns-text)]">{formatAdminNumber(total)}</div>
        </div>
        <div className="rounded-md border border-[var(--ns-border-subtle)] p-3">
          <div className="text-xs text-[var(--ns-text-muted)]">{t('admin.creators.statusValues.REGISTERED') || 'Registered'}</div>
          <div className="mt-1 text-xl font-bold text-[var(--ns-text)]">{formatAdminNumber(registeredCount)}</div>
        </div>
        <div className="rounded-md border border-[var(--ns-border-subtle)] p-3">
          <div className="text-xs text-[var(--ns-text-muted)]">{t('admin.creators.statusValues.REVIEWED') || 'Reviewed'}</div>
          <div className="mt-1 text-xl font-bold text-[var(--ns-text)]">{formatAdminNumber(reviewedCount)}</div>
        </div>
        <div className="rounded-md border border-[var(--ns-border-subtle)] p-3">
          <div className="text-xs text-[var(--ns-text-muted)]">{t('admin.creators.statusValues.ENABLED') || 'Enabled'}</div>
          <div className="mt-1 text-xl font-bold text-emerald-400">{formatAdminNumber(enabledCount)}</div>
        </div>
      </div>

      <AdminPanel>
        <AdminSearch
          value={search}
          onChange={(nextValue) => setFilter('search', nextValue)}
          placeholder={t('admin.creators.searchPlaceholder') || 'Search creators by name, username, or email...'}
        >
          <AdminSelect
            label={t('admin.creators.type') || 'Creator Type'}
            value={creatorType}
            onChange={(nextValue) => setFilter('creatorType', nextValue)}
            options={[
              ['', t('admin.creators.allTypes') || 'All Types'],
              ['ARTIST', t('admin.creators.types.ARTIST') || 'Artist'],
              ['BEATMAKER', t('admin.creators.types.BEATMAKER') || 'Beatmaker'],
              ['BOTH', t('admin.creators.types.BOTH') || 'Both'],
            ]}
          />
          <AdminSelect
            label={t('admin.status')}
            value={status}
            onChange={(nextValue) => setFilter('status', nextValue)}
            options={[
              ['', t('admin.allStatuses')],
              ['REGISTERED', t('admin.creators.statusValues.REGISTERED') || 'Registered'],
              ['REVIEWED', t('admin.creators.statusValues.REVIEWED') || 'Reviewed'],
              ['ENABLED', t('admin.creators.statusValues.ENABLED') || 'Enabled'],
            ]}
          />
        </AdminSearch>

        {loading ? (
          <AdminLoading />
        ) : error ? (
          <AdminError error={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <AdminEmpty text={t('admin.creators.noCreatorsFound') || 'No creator registrations found'} />
        ) : (
          <>
            <AdminTable>
              <thead>
                <tr>
                  {[
                    t('admin.creators.creator') || 'Creator',
                    t('admin.creators.type') || 'Type',
                    t('admin.creators.content') || 'Content',
                    t('admin.creators.links') || 'Portfolio / Link',
                    t('admin.status') || 'Status',
                    t('admin.artistAccess.title') || 'Artist Access',
                    t('admin.creators.registeredAt') || 'Registered',
                    t('admin.actions') || 'Actions',
                  ].map((label) => (
                    <AdminTableHead key={label}>{label}</AdminTableHead>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-border-subtle)] text-xs">
                {items.map((item) => {
                  const user = item.user || {};
                  const canUpload = item.userAccess?.canUploadTracks ?? user.canUploadTracks ?? false;
                  const link = item.portfolioUrl || item.primaryPlatformUrl;

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <div className="font-semibold text-[var(--ns-text)]">{item.displayName || user.displayName || user.username}</div>
                        <div className="text-[var(--ns-text-muted)]">@{user.username}</div>
                        <div className="text-[var(--ns-text-subtle)] text-[11px]">{user.email}</div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-200">
                          <Sparkles size={11} className="text-brand-red" />
                          {item.creatorType}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5 text-[11px]">
                          {item.intendsMusic && <span className="text-zinc-300">• Music / Songs</span>}
                          {item.intendsBeats && <span className="text-zinc-300">• Beats / Instrumentals</span>}
                        </div>
                      </td>
                      <td className="p-3 max-w-[180px] truncate">
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-brand-red hover:underline"
                            title={link}
                          >
                            <span className="truncate">{link.replace(/^https?:\/\/(www\.)?/, '')}</span>
                            <ExternalLink size={12} className="shrink-0" />
                          </a>
                        ) : (
                          <span className="text-[var(--ns-text-subtle)]">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={item.status} />
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item, e.target.value)}
                            className="rounded border border-[var(--ns-border-subtle)] bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300"
                            aria-label={t('admin.creators.changeStatus') || 'Change Status'}
                          >
                            <option value="REGISTERED">REGISTERED</option>
                            <option value="REVIEWED">REVIEWED</option>
                            <option value="ENABLED">ENABLED</option>
                          </select>
                        </div>
                        {item.adminNote && (
                          <div className="mt-1 text-[10px] italic text-[var(--ns-text-muted)] line-clamp-1" title={item.adminNote}>
                            Note: {item.adminNote}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {canUpload ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                            <ShieldCheck size={12} />
                            {t('admin.artistAccess.canUploadShort') || 'Active'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                            <ShieldAlert size={12} />
                            {t('admin.artistAccess.uploadBlockedShort') || 'Pending'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[var(--ns-text-muted)] whitespace-nowrap">
                        {formatAdminDate(item.createdAt)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {!canUpload ? (
                            <button
                              type="button"
                              onClick={() => setConfirmModal({ type: 'grant', creator: item })}
                              className="ns-button-primary rounded px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                            >
                              {t('admin.creators.grantAccess') || 'Grant Access'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmModal({ type: 'revoke', creator: item })}
                              className="ns-button-secondary rounded px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
                            >
                              {t('admin.creators.revokeAccess') || 'Revoke'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setNoteModal(item);
                              setNoteText(item.adminNote || '');
                            }}
                            className="ns-icon-button rounded p-1 text-[var(--ns-text-muted)] hover:text-zinc-100 cursor-pointer"
                            title={t('admin.creators.editNote') || 'Admin Note'}
                          >
                            <MessageSquare size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
            <AdminPagination
              pagination={pagination}
              onPage={setPage}
            />
          </>
        )}
      </AdminPanel>

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmActionModal
          open={Boolean(confirmModal)}
          title={
            confirmModal.type === 'grant'
              ? t('admin.creators.confirmGrantTitle') || 'Grant Artist Access'
              : t('admin.creators.confirmRevokeTitle') || 'Revoke Artist Access'
          }
          description={
            confirmModal.type === 'grant'
              ? t('admin.creators.confirmGrantDesc', { username: confirmModal.creator.user?.username }) ||
                `This will promote @${confirmModal.creator.user?.username} to ARTIST, activate their ArtistProfile, and grant immediate track upload access.`
              : t('admin.creators.confirmRevokeDesc', { username: confirmModal.creator.user?.username }) ||
                `This will demote @${confirmModal.creator.user?.username} to LISTENER and hide their artist profile.`
          }
          actionLabel={confirmModal.type === 'grant' ? 'Grant Access' : 'Revoke Access'}
          danger={confirmModal.type === 'revoke'}
          requireReason={false}
          onConfirm={({ reason }) => {
            if (confirmModal.type === 'grant') return handleGrantAccess(confirmModal.creator, reason);
            return handleRevokeAccess(confirmModal.creator, reason);
          }}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Admin Note Modal */}
      {noteModal && (
        <div
          className="fixed inset-0 z-[var(--ns-z-dialog)] flex items-center justify-center bg-[var(--ns-overlay)] p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNoteModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] p-6 shadow-xl">
            <h3 className="font-sans text-lg font-bold text-[var(--ns-text)]">
              {t('admin.creators.adminNoteTitle') || 'Admin Note for'} @{noteModal.user?.username}
            </h3>
            <p className="mt-1 text-xs text-[var(--ns-text-muted)]">
              Internal notes regarding this creator (portfolio review, contact notes, etc.)
            </p>
            <textarea
              className="ns-field mt-4 w-full h-28 p-3 text-xs"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add review notes, links verified, contact details..."
              maxLength={2000}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="ns-button-secondary rounded px-3 py-1.5 text-xs"
                onClick={() => setNoteModal(null)}
                disabled={actionLoading}
              >
                {t('admin.cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                className="ns-button-primary rounded px-4 py-1.5 text-xs font-semibold"
                onClick={handleSaveNote}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : t('admin.save') || 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
