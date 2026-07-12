import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  forceReprocessTrack,
  getAdminTrack,
  hideTrack,
  rejectTrack,
  removeTrackLyrics,
  restoreTrack,
  unhideTrack,
} from '../../api/admin';
import { useToastStore } from '../../store/toastStore';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  ConfirmActionModal,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { formatAdminDate, useAdminData } from '../../components/admin/adminUtils';
import { getGenreLabel } from '../../utils/genreLabels';

export default function AdminTrackDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const { data, loading, error, reload } = useAdminData(() => getAdminTrack(id), [id]);
  const [pendingAction, setPendingAction] = useState(null);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} onRetry={reload} />;
  const track = data?.track;
  if (!track) return <AdminEmpty text={t('admin.noTracksFound')} />;

  const actions = {
    hide: (reason) => hideTrack(id, reason),
    unhide: (reason) => unhideTrack(id, reason),
    reject: (reason) => rejectTrack(id, reason),
    restore: (reason) => restoreTrack(id, reason),
    reprocess: (reason) => forceReprocessTrack(id, reason),
    removeLyrics: (reason) => removeTrackLyrics(id, reason),
  };

  async function confirm(reason) {
    try {
      await actions[pendingAction](reason);
      addToast(t('admin.actionCompleted'), 'success');
      reload();
    } catch (actionError) {
      addToast(t('admin.actionFailed'), 'error');
      throw actionError;
    }
  }

  return (
    <>
      <AdminPageHeader
        title={track.title}
        description={track.artist?.user?.displayName}
        actions={<Link to="/admin/tracks" className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.backToTracks')}</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <AdminPanel className="p-4 lg:col-span-2">
          <h2 className="text-sm font-bold">{t('admin.trackMetadata')}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              [t('admin.status'), <StatusBadge key="status" status={track.status} />],
              [t('admin.genre'), track.genre ? getGenreLabel(track.genre) : '—'],
              [t('admin.tags'), track.tags?.join(', ') || '—'],
              [t('admin.plays'), track.plays],
              [t('admin.comments'), track._count?.comments ?? 0],
              [t('admin.streamAvailability'), track.streamAvailable ? t('admin.available') : t('admin.unavailable')],
              [t('admin.updated'), formatAdminDate(track.updatedAt, i18n.language)],
              [t('admin.uploadStatus'), track.uploads?.[0]?.status ? <StatusBadge key="upload-status" status={track.uploads[0].status} /> : t('admin.unavailable')],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--ns-text-muted)]">{label}</dt>
                <dd className="mt-1 text-sm text-[var(--ns-text-secondary)]">{value}</dd>
              </div>
            ))}
          </dl>
        </AdminPanel>
        <AdminPanel className="p-4">
          <h2 className="text-sm font-bold">{t('admin.actions')}</h2>
          <div className="mt-4 flex flex-col gap-2">
            {track.status === 'PUBLISHED' && <button type="button" onClick={() => setPendingAction('hide')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.hide')}</button>}
            {track.status === 'HIDDEN' && <button type="button" onClick={() => setPendingAction('unhide')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.unhide')}</button>}
            {['PUBLISHED', 'PENDING_REVIEW', 'HIDDEN'].includes(track.status) && <button type="button" onClick={() => setPendingAction('reject')} className="rounded bg-[var(--ns-danger)] px-3 py-2 text-xs font-semibold text-white">{t('admin.reject')}</button>}
            {track.status === 'REJECTED' && <button type="button" onClick={() => setPendingAction('restore')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.restore')}</button>}
            {['FAILED', 'REJECTED'].includes(track.status) && <button type="button" onClick={() => setPendingAction('reprocess')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.forceReprocess')}</button>}
            {track.hasLyrics && <button type="button" onClick={() => setPendingAction('removeLyrics')} className="rounded bg-[var(--ns-danger)] px-3 py-2 text-xs font-semibold text-white">{t('lyrics.remove')}</button>}
            {track.status === 'PUBLISHED' && <Link to={`/track/${track.id}`} className="ns-button-secondary rounded px-3 py-2 text-center text-xs">{t('admin.openPublicPage')}</Link>}
            {track.artist?.id && <Link to={`/admin/artists/${track.artist.id}`} className="ns-button-secondary rounded px-3 py-2 text-center text-xs">{t('admin.viewArtist')}</Link>}
          </div>
        </AdminPanel>
      </div>
      <AdminPanel className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">{t('admin.lyricsModeration')}</h2>
          <StatusBadge status={track.hasLyrics ? 'AVAILABLE' : 'NONE'} />
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--ns-text-muted)]">{t('lyrics.type')}</dt>
            <dd className="mt-1 text-sm text-[var(--ns-text-secondary)]">{track.lyricsType || 'NONE'}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--ns-text-muted)]">{t('lyrics.language')}</dt>
            <dd className="mt-1 text-sm text-[var(--ns-text-secondary)]">{track.lyricsLanguage || '—'}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--ns-text-muted)]">{t('lyrics.rightsConfirm')}</dt>
            <dd className="mt-1 text-sm text-[var(--ns-text-secondary)]">{track.lyricsRightsConfirmed ? t('admin.confirmed') : t('admin.unavailable')}</dd>
          </div>
        </dl>
        <div className="mt-4 max-h-80 overflow-y-auto rounded border border-[var(--ns-border-subtle)] bg-black/20 p-4">
          {track.hasLyrics
            ? <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ns-text-secondary)]">{track.lyricsText}</p>
            : <p className="text-sm text-[var(--ns-text-muted)]">{t('lyrics.noLyrics')}</p>}
        </div>
        {track.lyricsUpdatedAt && (
          <p className="mt-3 text-xs text-[var(--ns-text-muted)]">
            {t('admin.updated')}: {formatAdminDate(track.lyricsUpdatedAt, i18n.language)}
          </p>
        )}
      </AdminPanel>
      <AdminPanel className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('admin.reports')}</h2>
        {!data.reports?.length ? <AdminEmpty text={t('admin.noReportsYet')} /> : data.reports.map((report) => (
          <Link key={report.id} to={`/admin/reports/${report.id}`} className="flex items-center justify-between border-t border-[var(--ns-border-subtle)] py-3 text-xs first:border-0">
            <span>{t(`admin.statusValues.${report.reason}`, { defaultValue: report.reason })}</span>
            <StatusBadge status={report.status} />
          </Link>
        ))}
      </AdminPanel>
      <ConfirmActionModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={confirm}
        actionLabel={t('admin.confirm')}
      />
    </>
  );
}
