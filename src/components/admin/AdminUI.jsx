import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';
import { AlertTriangle, LoaderCircle, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AdminPageHeader({ title, description, actions }) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--ns-border-subtle)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words [overflow-wrap:anywhere] font-sans text-2xl font-bold tracking-tight text-[var(--ns-text)]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl break-words [overflow-wrap:anywhere] font-sans tabular-nums text-ns-label leading-relaxed text-[var(--ns-text-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap gap-2 sm:max-w-[55%]">{actions}</div>}
    </header>
  );
}

export function AdminPanel({ children, className = '', ...rest }) {
  return (
    <section {...rest} className={`min-w-0 [overflow-wrap:anywhere] rounded-md border border-[var(--ns-border-subtle)] bg-transparent ${className}`}>
      {children}
    </section>
  );
}

const STATUS_TONES = {
  ACTIVE: 'ns-status-success',
  READY: 'ns-status-success',
  APPROVED: 'ns-status-success',
  AVAILABLE: 'ns-status-success',
  CONFIGURED: 'ns-status-success',
  OK: 'ns-status-success',
  PUBLISHED: 'ns-status-success',
  REVIEWED: 'ns-status-success',
  ACTION_TAKEN: 'ns-status-success',
  VISIBLE: 'ns-status-success',
  PASS: 'ns-status-success',
  PROCESSING: 'ns-status-info',
  UPLOADING: 'ns-status-info',
  UPLOADED: 'ns-status-info',
  INITIATED: 'ns-status-info',
  PRODUCTION: 'ns-status-info',
  OPEN: 'ns-status-warning',
  ESCALATED: 'ns-status-warning',
  PENDING: 'ns-status-warning',
  PENDING_REVIEW: 'ns-status-warning',
  PARTIAL_READY: 'ns-status-warning',
  PARTIAL: 'ns-status-warning',
  DEGRADED: 'ns-status-warning',
  SUSPENDED: 'ns-status-warning',
  HIDDEN: 'ns-status-warning',
  DRAFT: 'ns-status-warning',
  'NOT-READY': 'ns-status-danger',
  FAIL: 'ns-status-danger',
  FAILED: 'ns-status-danger',
  BANNED: 'ns-status-danger',
  DELETED: 'ns-status-danger',
  REJECTED: 'ns-status-danger',
  ERROR: 'ns-status-danger',
  FAILURE: 'ns-status-danger',
  DENIED: 'ns-status-danger',
  MISSING: 'ns-status-danger',
  UNAVAILABLE: 'ns-status-danger',
  'NOT-FOUND': 'ns-status-danger',
  DISMISSED: 'ns-status-neutral',
  CANCELLED: 'ns-status-neutral',
  EXCLUDED: 'ns-status-neutral',
  NONE: 'ns-status-neutral',
  DISABLED: 'ns-status-neutral',
  REDACTED: 'ns-status-neutral',
  'NON-PRODUCTION': 'ns-status-neutral',
};

export function StatusBadge({ status }) {
  const { t } = useTranslation();
  const normalized = String(status || 'UNKNOWN').toUpperCase();
  return (
    <span className={`ns-badge ns-status-badge border font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label ${STATUS_TONES[normalized] || 'ns-status-neutral'}`}>
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
        <button type="button" onClick={onRetry} className="ns-button-secondary rounded px-3 py-2 text-sm">
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
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--ns-border-subtle)] p-3">
      <label className="relative min-w-0 basis-full grow lg:basis-56">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ns-text-muted)]" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="ns-field w-full rounded py-2 pl-9 pr-3 text-base sm:text-sm"
        />
      </label>
      {children && <div className="flex min-w-0 basis-full flex-wrap gap-2 lg:basis-auto lg:grow">{children}</div>}
    </div>
  );
}

export function AdminSelect({ value, onChange, label, options }) {
  return (
    <label className="min-w-0 flex-1 basis-36">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="ns-field w-full min-w-0 rounded px-3 py-2 text-base sm:text-sm">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export function AdminTable({ children }) {
  const { t } = useTranslation();
  return (
    <div className="relative max-h-[70dvh] max-w-full overflow-auto" tabIndex={0} role="region" aria-label={t('admin.scrollableTable')}>
      <table className="w-full min-w-[60rem] border-separate border-spacing-0 text-left text-sm [overflow-wrap:normal] [&_td]:align-top [&_td_.ns-button-secondary]:whitespace-nowrap [&_tbody_td]:border-b [&_tbody_td]:border-[var(--ns-border-subtle)] [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-[var(--ns-surface-hover)]">{children}</table>
    </div>
  );
}

export function AdminTableHead({ children }) {
  return <th className="sticky top-0 z-10 whitespace-nowrap border-b border-[var(--ns-border-strong)] bg-[var(--ns-bg-elevated)] px-4 py-3 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-[var(--ns-text-muted)]">{children}</th>;
}

export function AdminPagination({ pagination, onPage }) {
  const { t } = useTranslation();
  if (!pagination || pagination.total <= 0) return null;
  const page = Math.max(1, Number(pagination.page) || 1);
  const pageSize = Math.max(1, Number(pagination.pageSize || pagination.limit) || 25);
  const total = Math.max(0, Number(pagination.total) || 0);
  const totalPages = Math.max(1, Number(pagination.totalPages) || Math.ceil(total / pageSize));
  const first = Math.min(total, (page - 1) * pageSize + 1);
  const last = Math.min(total, page * pageSize);
  const pageCandidates = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  return (
    <nav className="flex flex-col items-start justify-between gap-3 border-t border-[var(--ns-border-subtle)] p-4 text-sm text-[var(--ns-text-muted)] sm:flex-row sm:items-center" aria-label={t('admin.pagination')}>
      <span className="flex flex-wrap gap-x-2">
        <span>{t('admin.paginationSummary', { first, last, total })}</span>
        <span>{t('admin.pageOf', { page, total: totalPages })}</span>
      </span>
      <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="ns-button-secondary min-h-11 rounded px-3 py-2 disabled:opacity-40"
        >
          {t('admin.previous')}
        </button>
        {pageCandidates.map((value, index) => (
          <React.Fragment key={value}>
            {index > 0 && value - pageCandidates[index - 1] > 1 && <span aria-hidden="true" className="px-1">…</span>}
            <button
              type="button"
              onClick={() => onPage(value)}
              aria-current={value === page ? 'page' : undefined}
              aria-label={t('admin.goToPage', { page: value })}
              className={`min-h-11 min-w-11 rounded border px-2 py-2 tabular-nums ${value === page ? 'border-[var(--ns-accent)] bg-[var(--ns-accent-soft)] text-[var(--ns-accent-text)]' : 'border-[var(--ns-border-subtle)] hover:bg-[var(--ns-hover-bg)]'}`}
            >
              {value}
            </button>
          </React.Fragment>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="ns-button-secondary min-h-11 rounded px-3 py-2 disabled:opacity-40"
        >
          {t('admin.next')}
        </button>
      </div>
    </nav>
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
  const dialogRef = useDialogFocusTrap(open, onClose);

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

  return createPortal(
    <div ref={dialogRef} className="fixed inset-0 z-[var(--ns-z-confirmation)] flex items-center justify-center bg-[var(--ns-overlay)] p-4" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
      <form onSubmit={submit} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] p-5 shadow-[var(--ns-shadow-modal)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="admin-confirm-title" className="text-lg font-bold tracking-tight text-[var(--ns-text)]">{title || t('admin.confirmAction')}</h2>
            {description && <p className="mt-1 text-sm text-[var(--ns-text-secondary)]">{description}</p>}
            <p className="mt-1 text-ns-label text-[var(--ns-text-muted)]">{t('admin.auditNotice')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('admin.close')} className="ns-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>
        {requireReason && (
          <label className="mt-5 block text-sm font-semibold text-[var(--ns-text-secondary)]">
            {t('admin.reason')}
            <textarea
              autoFocus
              required
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="ns-field mt-2 min-h-24 w-full resize-y rounded p-3 text-base sm:text-sm"
              placeholder={t('admin.reasonPlaceholder')}
            />
          </label>
        )}
        {options.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {options.map((option) => (
              <label key={option.key} className="flex items-start gap-2.5 text-sm text-[var(--ns-text-secondary)]">
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
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="ns-button-secondary rounded px-4 py-2 text-sm">
            {t('admin.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || (requireReason && !reason.trim())}
            className={`min-h-11 rounded px-4 py-2 text-sm font-semibold text-[var(--ns-on-danger)] disabled:opacity-40 ${danger ? 'bg-[var(--ns-danger)]' : 'bg-[var(--ns-accent)] text-[var(--ns-on-accent)]'}`}
          >
            {submitting ? t('admin.saving') : actionLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
