import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  forceReprocessTrack,
  getAdminTrack,
  getAdminTrackPreview,
  hideTrack,
  rejectTrack,
  restoreTrack,
  unhideTrack,
} from '../../api/admin';
import FallbackCover from '../ui/FallbackCover';
import { useToastStore } from '../../store/toastStore';
import AdminDetailDrawer from './AdminDetailDrawer';
import AdminMediaPreview from './AdminMediaPreview';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  ConfirmActionModal,
  StatusBadge,
} from './AdminUI';
import { formatAdminDate, useAdminData } from './adminUtils';
import { getGenreLabel } from '../../utils/genreLabels';

function MetadataItem({ label, children }) {
  return (
    <div className="min-w-0 border-b border-[var(--ns-border-subtle)] py-3 last:border-b-0">
      <dt className="text-ns-meta font-semibold uppercase tracking-ns-label text-[var(--ns-text-faint)]">{label}</dt>
      <dd className="mt-1 break-words [overflow-wrap:anywhere] text-sm text-[var(--ns-text-secondary)]">{children}</dd>
    </div>
  );
}

export default function AdminTrackDrawer({ trackId, onClose, onUpdated }) {
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const { data, loading, error, reload } = useAdminData(() => getAdminTrack(trackId), [trackId]);
  const preview = useAdminData(() => getAdminTrackPreview(trackId), [trackId]);
  const [pendingAction, setPendingAction] = useState(null);

  const track = data?.track;
  const actions = {
    hide: (reason) => hideTrack(trackId, reason),
    unhide: (reason) => unhideTrack(trackId, reason),
    reject: (reason) => rejectTrack(trackId, reason),
    restore: (reason) => restoreTrack(trackId, reason),
    reprocess: (reason) => forceReprocessTrack(trackId, reason),
  };

  async function confirm(reason) {
    try {
      await actions[pendingAction](reason);
      addToast(t('admin.actionCompleted'), 'success');
      reload();
      onUpdated?.();
    } catch (actionError) {
      addToast(t('admin.actionFailed'), 'error');
      throw actionError;
    }
  }

  const actionButtons = track ? (
    <div className="flex flex-wrap gap-2">
      {track.status === 'PUBLISHED' && (
        <button type="button" onClick={() => setPendingAction('hide')} className="ns-button-secondary rounded px-3 py-2 text-sm">
          {t('admin.hide')}
        </button>
      )}
      {track.status === 'HIDDEN' && (
        <button type="button" onClick={() => setPendingAction('unhide')} className="ns-button-secondary rounded px-3 py-2 text-sm">
          {t('admin.unhide')}
        </button>
      )}
      {['PUBLISHED', 'PENDING_REVIEW', 'HIDDEN'].includes(track.status) && (
        <button type="button" onClick={() => setPendingAction('reject')} className="rounded bg-[var(--ns-danger)] px-3 py-2 text-sm font-semibold text-[var(--ns-on-danger)]">
          {t('admin.reject')}
        </button>
      )}
      {track.status === 'REJECTED' && (
        <button type="button" onClick={() => setPendingAction('restore')} className="ns-button-secondary rounded px-3 py-2 text-sm">
          {t('admin.restore')}
        </button>
      )}
      {['FAILED', 'REJECTED'].includes(track.status) && (
        <button type="button" onClick={() => setPendingAction('reprocess')} className="ns-button-secondary rounded px-3 py-2 text-sm">
          {t('admin.forceReprocess')}
        </button>
      )}
    </div>
  ) : null;

  return (
    <>
      <AdminDetailDrawer
        open={Boolean(trackId)}
        onClose={onClose}
        title={track?.title || t('admin.trackDetails')}
        description={track?.artist?.user?.displayName || trackId}
        busy={loading}
        footer={track && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {actionButtons}
            <Link to={`/admin/tracks/${track.id}`} className="ns-button-secondary inline-flex items-center gap-2 rounded px-3 py-2 text-sm">
              {t('admin.openFullDetails')} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
        testId="admin-track-drawer"
      >
        {loading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={reload} /> : !track ? (
          <AdminEmpty text={t('admin.noTracksFound')} />
        ) : (
          <div className="space-y-5">
            <div className="flex min-w-0 items-center gap-4">
              <FallbackCover
                src={track.coverUrl}
                title={track.title}
                artistName={track.artist?.user?.displayName}
                genre={track.genre}
                className="h-20 w-20 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={track.status} /><StatusBadge status={track.contentType || 'MUSIC'} /></div>
                <p className="mt-2 break-all text-xs text-[var(--ns-text-faint)]">{track.id}</p>
              </div>
            </div>

            <AdminMediaPreview
              title={t('admin.moderationPreview')}
              description={t('admin.securePreviewDescription')}
              url={preview.data?.url}
              mediaLabel={t('admin.previewTrack', { title: track.title })}
              unavailableLabel={preview.loading ? t('admin.loadingPreview') : t('admin.previewUnavailable')}
            />
            {preview.error && <p className="text-sm text-[var(--ns-danger)]" role="status">{t('admin.previewUnavailable')}</p>}

            <section aria-labelledby="admin-track-metadata-title">
              <h3 id="admin-track-metadata-title" className="text-sm font-bold">{t('admin.trackMetadata')}</h3>
              <dl className="mt-2 grid min-w-0 grid-cols-2 gap-x-4">
                <MetadataItem label={t('admin.genre')}>{track.genre ? getGenreLabel(track.genre) : '—'}</MetadataItem>
                <MetadataItem label={t('admin.plays')}>{Number(track.plays || 0).toLocaleString(i18n.language)}</MetadataItem>
                <MetadataItem label={t('admin.reports')}>{track.reportsCount ?? data.reports?.length ?? 0}</MetadataItem>
                <MetadataItem label={t('admin.updated')}>{formatAdminDate(track.updatedAt, i18n.language)}</MetadataItem>
                <MetadataItem label={t('admin.streamAvailability')}>{track.streamAvailable ? t('admin.available') : t('admin.unavailable')}</MetadataItem>
                <MetadataItem label={t('admin.uploadStatus')}><StatusBadge status={track.uploads?.[0]?.status || 'UNAVAILABLE'} /></MetadataItem>
              </dl>
            </section>

            {data.reports?.length > 0 && (
              <section aria-labelledby="admin-track-reports-title">
                <h3 id="admin-track-reports-title" className="text-sm font-bold">{t('admin.reports')}</h3>
                <div className="mt-2 divide-y divide-[var(--ns-border-subtle)] border-y border-[var(--ns-border-subtle)]">
                  {data.reports.slice(0, 4).map((report) => (
                    <Link key={report.id} to={`/admin/reports/${report.id}`} className="flex min-w-0 items-center justify-between gap-3 py-3 text-sm hover:text-[var(--ns-accent-text)]">
                      <span className="min-w-0 truncate">{t(`admin.statusValues.${report.reason}`, { defaultValue: report.reason })}</span>
                      <StatusBadge status={report.status} />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </AdminDetailDrawer>
      <ConfirmActionModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={confirm}
        actionLabel={t('admin.confirm')}
        danger={['hide', 'reject'].includes(pendingAction)}
      />
    </>
  );
}
