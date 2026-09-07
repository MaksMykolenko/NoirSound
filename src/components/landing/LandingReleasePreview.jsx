import React, { useEffect, useId, useRef } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LandingReleasePreview({ open, onClose, title, artistCredit, contentType, onContinue }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="release-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-notice`}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <button className="dialog-close icon-button" type="button" onClick={onClose} aria-label={t('landing.creator.closePreview')}>
        <X className="icon" aria-hidden="true" />
      </button>
      <div className="release-dialog-body">
        <img src={`/landing/${contentType === 'BEAT' ? 'b1' : 'm1'}.svg`} width="320" height="320" alt={t('landing.creator.decorativeArtwork')} />
        <span className="eyebrow">{t(contentType === 'BEAT' ? 'landing.creator.beatPreview' : 'landing.creator.musicPreview')}</span>
        <h2 id={`${id}-title`}>{title || t('landing.creator.defaultTitle')}</h2>
        <p>{artistCredit || t('landing.creator.defaultArtist')}</p>
        <button className="button button-light" type="button" onClick={onContinue}>
          {t('landing.creator.continueUpload')} <ArrowUpRight className="icon" aria-hidden="true" />
        </button>
        <p className="preview-note" id={`${id}-notice`}>{t('landing.creator.visualPreviewNote')}</p>
        <p className="preview-not-published">{t('landing.creator.notPublished')}</p>
      </div>
    </dialog>
  );
}
