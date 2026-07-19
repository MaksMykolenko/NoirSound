import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';

export default function ProfileBannerRemoveDialog({ isOpen, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const dialogRef = useDialogFocusTrap(isOpen, onCancel);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[var(--ns-z-confirmation)] flex items-center justify-center bg-black/75 p-4">
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="profile-banner-remove-title"
        aria-describedby="profile-banner-remove-description"
        className="w-full max-w-md rounded-lg border border-rose-500/30 bg-[var(--ns-bg-elevated)] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
              <Trash2 size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="profile-banner-remove-title" className="text-lg font-semibold text-[var(--ns-text-primary)]">
                {t('profile.bannerRemoveTitle', { defaultValue: 'Remove profile banner?' })}
              </h2>
              <p id="profile-banner-remove-description" className="mt-1 text-sm leading-relaxed text-[var(--ns-text-secondary)]">
                {t('profile.bannerRemoveDescription', {
                  defaultValue: 'Your current banner will be removed when you save these profile changes.',
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="ns-icon-button !min-h-11 !min-w-11 shrink-0"
            aria-label={t('profile.bannerRemoveClose', { defaultValue: 'Close banner removal dialog' })}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="ns-button-secondary min-h-11 px-5 text-sm font-semibold"
          >
            {t('profile.bannerRemoveCancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-md bg-rose-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            {t('profile.bannerRemoveConfirm', { defaultValue: 'Remove banner' })}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
