import React, { useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AdminPageHeader({ title, description, actions }) {
  return (
    <header className="flex flex-col gap-3 border-b border-[var(--ns-border-subtle)] pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-[var(--ns-text)] sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl font-mono text-[11px] leading-relaxed text-[var(--ns-text-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function AdminPanel({ children, className = '', ...rest }) {
  return (
    <section {...rest} className={`rounded-md border border-[var(--ns-border-subtle)] bg-[color-mix(in_srgb,var(--ns-surface)_72%,transparent)] ${className}`}>
      {children}
    </section>
  );
}

const STATUS_TONES = {
  ACTIVE: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25',
  READY: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25',
  PUBLISHED: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25',
  REVIEWED: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25',
  ACTION_TAKEN: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25',
  PASS: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25',
  FAIL: 'text-red-400 bg-red-500/12 border-red-500/25',
  OPEN: 'text-amber-400 bg-amber-500/12 border-amber-500/25',
  ESCALATED: 'text-orange-400 bg-orange-500/12 border-orange-500/25',
  PROCESSING: 'text-sky-400 bg-sky-500/12 border-sky-500/25',
  UPLOADING: 'text-sky-400 bg-sky-500/12 border-sky-500/25',
  INITIATED: 'text-sky-400 bg-sky-500/12 border-sky-500/25',
  SUSPENDED: 'text-amber-400 bg-amber-500/12 border-amber-500/25',
  HIDDEN: 'text-amber-400 bg-amber-500/12 border-amber-500/25',
  FAILED: 'text-red-400 bg-red-500/12 border-red-500/25',
  BANNED: 'text-red-400 bg-red-500/12 border-red-500/25',
  REJECTED: 'text-red-400 bg-red-500/12 border-red-500/25',
  DISMISSED: 'text-zinc-400 bg-zinc-500/12 border-zinc-500/25',
  CANCELLED: 'text-zinc-400 bg-zinc-500/12 border-zinc-500/25',
};

export function StatusBadge({ status }) {
  const { t } = useTranslation();
  const normalized = String(status || 'UNKNOWN').toUpperCase();
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${STATUS_TONES[normalized] || 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20'}`}>
      {t(`admin.statusValues.${normalized}`, { defaultValue: normalized.replaceAll('_', ' ') })}
    </span>
  );
}

export function AdminLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[var(--ns-text-muted)]">
      <LoaderCircle className="h-4 w-4 animate-spin" /> {t('admin.loading')}
    </div>
  );
}

export function AdminError({ error, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-[var(--ns-danger)]" />
      <p className="text-sm text-[var(--ns-text-secondary)]">
        {error?.status === 403 ? t('admin.accessDenied') : t('admin.loadFailed')}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="ns-button-secondary rounded px-3 py-2 text-xs">
          {t('admin.retry')}
        </button>
      )}
    </div>
  );
}

export function AdminEmpty({ text }) {
  return <div className="p-10 text-center text-sm text-[var(--ns-text-muted)]">{text}</div>;
}

export function AdminSearch({ value, onChange, placeholder, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--ns-border-subtle)] p-3 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ns-text-muted)]" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="ns-field w-full rounded py-2 pl-9 pr-3 text-sm"
        />
      </label>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function AdminSelect({ value, onChange, label, options }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="ns-field min-h-10 rounded px-3 py-2 text-sm">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export function AdminTable({ children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-white/[0.02]">{children}</table>
    </div>
  );
}

export function AdminTableHead({ children }) {
  return <th className="bg-black/10 px-4 py-3 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--ns-text-muted)]">{children}</th>;
}

export function AdminPagination({ pagination, onPage }) {
  const { t } = useTranslation();
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--ns-border-subtle)] p-4 text-xs text-[var(--ns-text-muted)]">
      <span>{t('admin.pageOf', { page: pagination.page, total: pagination.totalPages })}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="ns-button-secondary rounded px-3 py-2 disabled:opacity-40"
        >
          {t('admin.previous')}
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
          className="ns-button-secondary rounded px-3 py-2 disabled:opacity-40"
        >
          {t('admin.next')}
        </button>
      </div>
    </div>
  );
}

export function ConfirmActionModal({
  open,
  title,
  description,
  actionLabel,
  onClose,
  onConfirm,
  requireReason = true,
  danger = true,
  options = [],
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [optionValues, setOptionValues] = useState({});

  useEffect(() => {
    if (open) {
      setReason('');
      setOptionValues(Object.fromEntries(
        options.map((option) => [option.key, option.defaultChecked !== false])
      ));
    }
    // `options` is expected to be a stable array literal from the caller;
    // re-running only when the modal opens avoids resetting mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    if (requireReason && !reason.trim()) return;
    setSubmitting(true);
    try {
      // Preserve the original single-argument signature when no options are
      // configured, so existing callers/tests are unaffected.
      if (options.length > 0) {
        await onConfirm(reason.trim(), optionValues);
      } else {
        await onConfirm(reason.trim());
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[var(--ns-z-dialog)] flex items-center justify-center bg-[var(--ns-overlay)] p-4" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="admin-confirm-title" className="font-bold text-[var(--ns-text)]">{title || t('admin.confirmAction')}</h2>
            {description && <p className="mt-1 text-xs text-[var(--ns-text-secondary)]">{description}</p>}
            <p className="mt-1 text-xs text-[var(--ns-text-muted)]">{t('admin.auditNotice')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('admin.close')} className="ns-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>
        {requireReason && (
          <label className="mt-5 block text-xs font-semibold text-[var(--ns-text-secondary)]">
            {t('admin.reason')}
            <textarea
              autoFocus
              required
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="ns-field mt-2 min-h-24 w-full resize-y rounded p-3 text-sm"
              placeholder={t('admin.reasonPlaceholder')}
            />
          </label>
        )}
        {options.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {options.map((option) => (
              <label key={option.key} className="flex items-start gap-2.5 text-xs text-[var(--ns-text-secondary)]">
                <input
                  type="checkbox"
                  checked={Boolean(optionValues[option.key])}
                  onChange={(event) => setOptionValues((prev) => ({ ...prev, [option.key]: event.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-[var(--ns-accent)]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ns-button-secondary rounded px-4 py-2 text-sm">
            {t('admin.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || (requireReason && !reason.trim())}
            className={`rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${danger ? 'bg-[var(--ns-danger)]' : 'bg-[var(--ns-accent)] text-[var(--ns-on-accent)]'}`}
          >
            {submitting ? t('admin.saving') : actionLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
