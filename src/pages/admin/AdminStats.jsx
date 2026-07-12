import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStatsIntegrity, recalculateArtistStats, recalculateStats } from '../../api/admin';
import { useToastStore } from '../../store/toastStore';
import {
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  ConfirmActionModal,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { formatAdminDate, useAdminData } from '../../components/admin/adminUtils';

// Mirrors the `counts`/`details` keys returned by GET /admin/stats/integrity
// (backend/src/lib/statsIntegrity.js) -- kept in the same order as the CLI
// (`npm run stats:check`) so the two never read as inconsistent.
const CHECK_KEYS = [
  'duplicateFollows',
  'missingArtistProfiles',
  'orphanArtistProfiles',
  'staleTrackPlayCounts',
  'staleMonthlyListeners',
  'orphanPlayEvents',
  'orphanFollows',
];

function detailLabel(key, row) {
  switch (key) {
    case 'duplicateFollows':
      return `user ${row.userId} -> artist ${row.artistId} (${row.count}x)`;
    case 'missingArtistProfiles':
      return `${row.username || row.id} <${row.email || '—'}> [${row.role}]`;
    case 'orphanArtistProfiles':
      return `artistProfile ${row.artistProfileId} -> missing user ${row.userId}`;
    case 'staleTrackPlayCounts':
      return `"${row.title}": stored=${row.storedPlays} actual=${row.actualQualifiedPlayEvents}`;
    case 'staleMonthlyListeners':
      return `${row.username || row.artistId}: stored=${row.storedMonthlyListeners} actual=${row.actualMonthlyListeners}`;
    case 'orphanPlayEvents':
      return `playEvent ${row.playEventId} (track=${row.trackId}, user=${row.userId})`;
    case 'orphanFollows':
      return `user ${row.userId} -> artist ${row.artistId}`;
    default:
      return JSON.stringify(row);
  }
}

export default function AdminStats() {
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const { data: report, loading, error, reload } = useAdminData(getStatsIntegrity);
  // { type: 'all' | 'monthlyListeners' | 'trackPlays' } for the bulk
  // recalculate actions, or { type: 'artist', artistId } for the per-row
  // one-off fix next to a specific stale-monthly-listener entry.
  const [pendingAction, setPendingAction] = useState(null);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} onRetry={reload} />;

  const counts = report?.counts || {};
  const details = report?.details || {};
  const totalIssues = Object.values(counts).reduce((sum, value) => sum + (value || 0), 0);

  const modalConfig = {
    all: { title: t('admin.statsIntegrity.recalculateAll'), actionLabel: t('admin.statsIntegrity.recalculateAll'), danger: false },
    monthlyListeners: { title: t('admin.statsIntegrity.recalculateMonthlyListeners'), actionLabel: t('admin.statsIntegrity.recalculateMonthlyListeners'), danger: false },
    trackPlays: { title: t('admin.statsIntegrity.recalculateTrackPlays'), actionLabel: t('admin.statsIntegrity.recalculateTrackPlays'), danger: false },
    artist: { title: t('admin.statsIntegrity.recalculateArtist'), actionLabel: t('admin.statsIntegrity.recalculateArtist'), danger: false },
  };
  const activeModal = pendingAction ? modalConfig[pendingAction.type] : null;

  async function confirm(reason) {
    try {
      if (pendingAction.type === 'artist') {
        await recalculateArtistStats(pendingAction.artistId, reason);
      } else {
        await recalculateStats(reason, pendingAction.type);
      }
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
        title={t('admin.statsIntegrity.title')}
        description={t('admin.statsIntegrity.description')}
        actions={
          <>
            <button type="button" onClick={() => setPendingAction({ type: 'monthlyListeners' })} className="ns-button-secondary rounded px-3 py-2 text-sm">
              {t('admin.statsIntegrity.recalculateMonthlyListeners')}
            </button>
            <button type="button" onClick={() => setPendingAction({ type: 'trackPlays' })} className="ns-button-secondary rounded px-3 py-2 text-sm">
              {t('admin.statsIntegrity.recalculateTrackPlays')}
            </button>
            <button type="button" onClick={() => setPendingAction({ type: 'all' })} className="ns-button-primary rounded px-3 py-2 text-sm">
              {t('admin.statsIntegrity.recalculateAll')}
            </button>
          </>
        }
      />

      <AdminPanel className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{t('admin.statsIntegrity.verdict')}</h2>
          <StatusBadge status={report?.verdict} />
        </div>
        {report?.generatedAt && (
          <p className="mt-2 text-sm text-[var(--ns-text-muted)]">
            {t('admin.statsIntegrity.checkedAt')}: {formatAdminDate(report.generatedAt, i18n.language)}
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CHECK_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between rounded border border-[var(--ns-border-subtle)] bg-black/10 p-3">
              <span className="text-sm font-semibold">{t(`admin.statsIntegrity.checks.${key}`)}</span>
              <span className={`font-sans tabular-nums text-sm font-medium ${counts[key] > 0 ? 'text-[var(--ns-danger)]' : 'text-emerald-400'}`}>{counts[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </AdminPanel>

      {totalIssues === 0 ? (
        <AdminPanel className="p-6 text-center text-sm text-[var(--ns-text-muted)]">
          {t('admin.statsIntegrity.noIssues')}
        </AdminPanel>
      ) : (
        CHECK_KEYS.filter((key) => (counts[key] || 0) > 0).map((key) => (
          <AdminPanel key={key} className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{t(`admin.statsIntegrity.checks.${key}`)} ({counts[key]})</h2>
              {key === 'staleMonthlyListeners' && (
                <button type="button" onClick={() => setPendingAction({ type: 'monthlyListeners' })} className="ns-button-secondary rounded px-3 py-1.5 text-ns-label">
                  {t('admin.statsIntegrity.recalculateMonthlyListeners')}
                </button>
              )}
              {key === 'staleTrackPlayCounts' && (
                <button type="button" onClick={() => setPendingAction({ type: 'trackPlays' })} className="ns-button-secondary rounded px-3 py-1.5 text-ns-label">
                  {t('admin.statsIntegrity.recalculateTrackPlays')}
                </button>
              )}
            </div>
            <div className="mt-3 space-y-1.5">
              {(details[key] || []).slice(0, 25).map((row, index) => (
                <div key={index} className="flex items-center justify-between gap-3 border-t border-[var(--ns-border-subtle)] py-2 text-sm first:border-0">
                  <span className="min-w-0 truncate text-[var(--ns-text-secondary)]">{detailLabel(key, row)}</span>
                  {key === 'staleMonthlyListeners' && row.artistId && (
                    <button
                      type="button"
                      onClick={() => setPendingAction({ type: 'artist', artistId: row.artistId })}
                      className="ns-button-secondary shrink-0 rounded px-2 py-1 text-ns-meta"
                    >
                      {t('admin.statsIntegrity.recalculateArtist')}
                    </button>
                  )}
                </div>
              ))}
              {(details[key] || []).length > 25 && (
                <p className="pt-1 text-ns-label text-[var(--ns-text-muted)]">
                  +{(details[key] || []).length - 25} more
                </p>
              )}
            </div>
          </AdminPanel>
        ))
      )}

      <ConfirmActionModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={confirm}
        title={activeModal?.title}
        actionLabel={activeModal?.actionLabel}
        danger={activeModal?.danger}
      />
    </>
  );
}
