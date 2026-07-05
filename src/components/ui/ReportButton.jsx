import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { submitReport, REPORT_REASONS } from '../../api/moderation';
import { useUserStore } from '../../store/userStore';
import { useToastStore } from '../../store/toastStore';

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
export default function ReportButton({ targetType, targetId, className = '', label = 'Report' }) {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const setAuthModalOpen = useUserStore((s) => s.setAuthModalOpen);
  const addToast = useToastStore((s) => s.addToast);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('COPYRIGHT');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reasonLabels = {
    ...REASON_LABELS,
    LYRICS_COPYRIGHT: t('reports.reasonLyricsCopyright'),
    LYRICS_OFFENSIVE: t('reports.reasonLyricsOffensive'),
    LYRICS_INCORRECT: t('reports.reasonLyricsIncorrect'),
  };

  function handleOpen() {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitReport({ targetType, targetId, reason, details: details.trim() || undefined });
      addToast('Report submitted. Our moderators will review it.', 'success');
      setOpen(false);
      setDetails('');
    } catch (err) {
      addToast(err.message || 'Could not submit report.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-brand-red transition-colors ${className}`}
        aria-label={`Report this ${targetType.toLowerCase()}`}
      >
        <Flag className="w-3.5 h-3.5" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70" onClick={() => setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
          >
            <h2 className="text-lg font-bold text-white mb-1">Report {targetType.toLowerCase()}</h2>
            <p className="text-xs text-zinc-500 mb-4">Tell us what’s wrong. False reports may affect your account.</p>

            <label className="block text-xs font-semibold text-zinc-400 mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full mb-4 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>{reasonLabels[r] || r}</option>
              ))}
            </select>

            <label className="block text-xs font-semibold text-zinc-400 mb-1">Details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              className="w-full mb-4 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 resize-none"
              placeholder="Add any context that helps moderators."
            />

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 rounded-lg bg-brand-red hover:bg-brand-red/90 text-sm font-semibold text-white disabled:opacity-60">
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
