import React, { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { submitReport, REPORT_REASONS } from '../../api/moderation';
import { useUserStore } from '../../store/userStore';
import { useToastStore } from '../../store/toastStore';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';

const REASON_LABELS = {
  COPYRIGHT: 'Copyright infringement',
  SPAM: 'Spam or misleading',
  HARASSMENT: 'Harassment',
  HATE: 'Hate speech',
  NSFW: 'Inappropriate / NSFW',
  OTHER: 'Something else',
};

/**
 * Report control for a track, comment, user, or playlist.
 * Renders a small button that opens a reason modal and submits to /api/reports.
 */
export function ReportDialog({ targetType, targetId, onClose }) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [reason, setReason] = useState('COPYRIGHT');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useDialogFocusTrap(true, () => { if (!submitting) onClose(); });
  const id = useId();
  const reasonLabels = {
    ...Object.fromEntries(Object.entries(REASON_LABELS).map(([key, fallback]) => [key, t(`reports.reasons.${key}`, { defaultValue: fallback })])),
    LYRICS_COPYRIGHT: t('reports.reasonLyricsCopyright'),
    LYRICS_OFFENSIVE: t('reports.reasonLyricsOffensive'),
    LYRICS_INCORRECT: t('reports.reasonLyricsIncorrect'),
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitReport({ targetType, targetId, reason, details: details.trim() || undefined });
      addToast(t('reports.submitted', { defaultValue: 'Report submitted. Our moderators will review it.' }), 'success');
      onClose();
      setDetails('');
    } catch (err) {
      addToast(err.message || t('reports.submitError', { defaultValue: 'Could not submit report.' }), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[var(--ns-z-confirmation)] flex items-center justify-center bg-black/75 p-4" onClick={submitting ? undefined : onClose}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-help`}
        aria-busy={submitting}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] p-5 shadow-xl"
      >
        <h2 id={`${id}-title`} className="mb-1 break-words text-lg font-semibold tracking-tight text-[var(--ns-text)]">{t('reports.title', { defaultValue: 'Report content' })}</h2>
        <p id={`${id}-help`} className="text-sm text-zinc-500 mb-4">{t('reports.help', { defaultValue: 'Tell us what’s wrong. False reports may affect your account.' })}</p>

        <label htmlFor={`${id}-reason`} className="block text-sm font-semibold text-zinc-400 mb-1">{t('reports.reason', { defaultValue: 'Reason' })}</label>
        <select
          id={`${id}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="ns-field mb-4 w-full rounded-md px-3 py-2 text-base sm:text-sm"
        >
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>{reasonLabels[r] || r}</option>
          ))}
        </select>

        <label htmlFor={`${id}-details`} className="block text-sm font-semibold text-zinc-400 mb-1">{t('reports.details', { defaultValue: 'Details (optional)' })}</label>
        <textarea
          id={`${id}-details`}
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          className="ns-field mb-4 w-full resize-none rounded-md px-3 py-2 text-base sm:text-sm"
          placeholder={t('reports.detailsPlaceholder', { defaultValue: 'Add any context that helps moderators.' })}
        />

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting}
            className="ns-button-secondary rounded-md px-4 py-2 text-sm">
            {t('actions.cancel')}
          </button>
          <button type="submit" disabled={submitting}
            className="ns-button-primary rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {submitting ? t('reports.submitting', { defaultValue: 'Submitting…' }) : t('reports.submit', { defaultValue: 'Submit report' })}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function ReportButton({ targetType, targetId, className = '', label }) {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const setAuthModalOpen = useUserStore((s) => s.setAuthModalOpen);
  const [open, setOpen] = useState(false);

  function handleOpen() {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-brand-red transition-colors ${className}`}
        aria-label={t('contextMenu.report')}
      >
        <Flag className="w-3.5 h-3.5" /> {label || t('contextMenu.report')}
      </button>
      {open && (
        <ReportDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
