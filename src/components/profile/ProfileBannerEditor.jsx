import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageOff, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProfileBannerRemoveDialog from './ProfileBannerRemoveDialog';
import { validateProfileBannerFile } from './profileBannerValidation';

export default function ProfileBannerEditor({
  currentBannerUrl,
  pendingFile,
  removalRequested,
  disabled = false,
  progress = null,
  statusMessage = '',
  onSelectFile,
  onConfirmRemove,
  onUndoRemove,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const uploadTriggerRef = useRef(null);
  const removeTriggerRef = useRef(null);
  const undoButtonRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  useEffect(() => {
    if (!pendingFile || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(pendingFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL?.(objectUrl);
  }, [pendingFile]);

  const displayedUrl = removalRequested ? '' : (previewUrl || currentBannerUrl || '');

  useEffect(() => {
    setPreviewFailed(false);
  }, [displayedUrl]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    const validationResult = validateProfileBannerFile(file);
    if (validationResult === 'type') {
      setValidationError(t('profile.bannerFileTypeError', {
        defaultValue: 'Choose a JPEG, PNG, or WebP image.',
      }));
      return;
    }
    if (validationResult === 'size') {
      setValidationError(t('profile.bannerFileSizeError', {
        defaultValue: 'Choose an image that is larger than 0 bytes and no larger than 8 MB.',
      }));
      return;
    }

    setValidationError('');
    onSelectFile(file);
  };

  const hasBanner = Boolean(pendingFile || currentBannerUrl) && !removalRequested;
  const replaceLabel = hasBanner
    ? t('profile.bannerReplace', { defaultValue: 'Replace banner' })
    : t('profile.bannerUpload', { defaultValue: 'Upload banner' });

  const closeRemoveDialog = useCallback(() => {
    setRemoveDialogOpen(false);
    window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
  }, []);

  const confirmRemove = () => {
    const willOfferUndo = Boolean(currentBannerUrl);
    onConfirmRemove();
    setValidationError('');
    setRemoveDialogOpen(false);
    window.requestAnimationFrame(() => {
      const focusTarget = willOfferUndo ? undoButtonRef.current : uploadTriggerRef.current;
      focusTarget?.focus();
    });
  };

  return (
    <section
      aria-labelledby="profile-banner-editor-title"
      className="border-b border-[var(--ns-border-subtle)] pb-5"
      data-testid="profile-banner-editor"
    >
      <div
        data-testid="profile-banner-settings-grid"
        className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start lg:gap-5 xl:gap-6"
      >
        <div className="min-w-0 lg:col-span-7 xl:col-span-8">
          <div
            data-testid="profile-banner-preview"
            className="relative aspect-[3/1] max-h-[260px] w-full max-w-[780px] overflow-hidden rounded-lg border border-[var(--ns-border-strong)] bg-[var(--ns-surface-elevated)]"
          >
            {displayedUrl && !previewFailed ? (
              <img
                src={displayedUrl}
                alt={t('profile.bannerPreviewAlt', { defaultValue: 'Profile banner preview' })}
                onError={() => setPreviewFailed(true)}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div
                role="img"
                aria-label={t('profile.bannerFallback', { defaultValue: 'No profile banner selected' })}
                className="flex h-full w-full items-center justify-center bg-[var(--ns-surface-elevated)] text-[var(--ns-text-muted)]"
              >
                <ImageOff size={28} aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        <div
          data-testid="profile-banner-controls"
          className="min-w-0 space-y-4 rounded-lg border border-[var(--ns-border-subtle)] bg-[var(--ns-card-solid)] p-4 sm:p-5 lg:col-span-5 xl:col-span-4"
        >
          <div>
            <h2 id="profile-banner-editor-title" className="text-sm font-semibold text-[var(--ns-text-primary)]">
              {t('profile.bannerSectionTitle', { defaultValue: 'Profile banner' })}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ns-text-secondary)]">
              {t('profile.bannerSectionDescription', {
                defaultValue: 'Personalize the wide image at the top of your profile.',
              })}
            </p>
          </div>

          <p id="profile-banner-file-help" className="text-ns-meta leading-relaxed text-[var(--ns-text-muted)]">
            {t('profile.bannerFormatsHelp', {
              defaultValue: 'JPEG, PNG, or WebP up to 8 MB. A wide 3:1 image works best.',
            })}
          </p>

          <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap lg:flex-col 2xl:flex-row">
            <label htmlFor="profile-banner-file" className="sr-only">
              {t('profile.bannerChooseFile', { defaultValue: 'Choose a profile banner' })}
            </label>
            <input
              ref={inputRef}
              id="profile-banner-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={disabled}
              aria-invalid={validationError ? 'true' : undefined}
              aria-errormessage={validationError ? 'profile-banner-file-error' : undefined}
              aria-describedby="profile-banner-file-help"
              className="sr-only"
            />
            <button
              ref={uploadTriggerRef}
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="ns-button-secondary flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-50 min-[480px]:w-auto lg:w-full 2xl:w-auto"
            >
              <ImagePlus size={17} aria-hidden="true" />
              {replaceLabel}
            </button>

            {hasBanner && (
              <button
                ref={removeTriggerRef}
                type="button"
                onClick={() => setRemoveDialogOpen(true)}
                disabled={disabled}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-rose-500/30 px-4 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-50 min-[480px]:w-auto lg:w-full 2xl:w-auto"
              >
                <Trash2 size={16} aria-hidden="true" />
                {t('profile.bannerRemove', { defaultValue: 'Remove banner' })}
              </button>
            )}

            {removalRequested && (
              <button
                ref={undoButtonRef}
                type="button"
                onClick={onUndoRemove}
                disabled={disabled}
                className="ns-button-secondary flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-50 min-[480px]:w-auto lg:w-full 2xl:w-auto"
              >
                <RotateCcw size={16} aria-hidden="true" />
                {t('profile.bannerUndoRemove', { defaultValue: 'Undo removal' })}
              </button>
            )}
          </div>

          {validationError && (
            <p id="profile-banner-file-error" role="alert" className="text-sm font-semibold text-rose-300">
              {validationError}
            </p>
          )}

          {removalRequested && (
            <p role="status" className="text-sm text-[var(--ns-warning)]">
              {t('profile.bannerRemovalStaged', {
                defaultValue: 'Banner removal is ready. Save changes to apply it.',
              })}
            </p>
          )}

          {progress !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-ns-meta text-[var(--ns-text-secondary)]">
                <span role="status">
                  {t('profile.bannerUploadProgress', { defaultValue: 'Uploading banner' })}
                </span>
                <span aria-hidden="true">{progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-label={t('profile.bannerUploadProgress', { defaultValue: 'Uploading banner' })}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={progress}
                className="h-1.5 overflow-hidden rounded-full bg-[var(--ns-surface)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--ns-accent)] transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {statusMessage && (
            <p role="status" className="text-sm font-semibold text-[var(--ns-success)]">
              {statusMessage}
            </p>
          )}
        </div>
      </div>

      <ProfileBannerRemoveDialog
        isOpen={removeDialogOpen}
        onCancel={closeRemoveDialog}
        onConfirm={confirmRemove}
      />
    </section>
  );
}
