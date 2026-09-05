import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';

export default function AdminDetailDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  busy = false,
  testId = 'admin-detail-drawer',
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useDialogFocusTrap(open, onClose);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={drawerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={busy || undefined}
      data-ns-overlay
      data-testid={testId}
      className="fixed inset-0 z-[var(--ns-z-dialog)] flex justify-end bg-[var(--ns-overlay)]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex h-full w-full max-w-[30rem] min-w-0 flex-col border-l border-[var(--ns-border)] bg-[var(--ns-card-solid)] shadow-[var(--ns-shadow-modal)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--ns-border-subtle)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words [overflow-wrap:anywhere] text-lg font-bold text-[var(--ns-text)]">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 break-words [overflow-wrap:anywhere] text-sm text-[var(--ns-text-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ns-icon-button shrink-0"
            aria-label={t('admin.close')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {children}
        </div>
        {footer && (
          <footer className="shrink-0 border-t border-[var(--ns-border-subtle)] px-4 py-4 sm:px-6">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body
  );
}
