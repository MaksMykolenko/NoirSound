import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, ListMusic, CheckCircle } from 'lucide-react';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';

export default function CreatePlaylistModal({ isOpen, onClose, onCreate }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useDialogFocusTrap(isOpen && !isSubmitting, onClose);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Playlist name is required.');
      return;
    }
    if (name.trim().length > 120) {
      setErrorMsg('Playlist name must be at most 120 characters.');
      return;
    }
    if (description.trim().length > 1000) {
      setErrorMsg('Description must be at most 1000 characters.');
      return;
    }
    try {
      setIsSubmitting(true);
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        isPublic,
      });
      setName('');
      setDescription('');
      setIsPublic(false);
    } catch (error) {
      setErrorMsg(error.message || 'Playlist could not be created.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[var(--ns-z-dialog)] flex items-center justify-center bg-black/70 p-4 select-none">
      <div ref={dialogRef} className="relative w-full max-w-sm rounded-lg border border-zinc-700/70 bg-zinc-950 p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="playlist-modal-title">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 ns-icon-button !min-h-10 !min-w-10 cursor-pointer"
          aria-label="Close create playlist dialog"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-brand-red/20 bg-brand-red/5">
            <ListMusic size={20} className="text-brand-red" />
          </div>
          <h2 id="playlist-modal-title" className="text-lg font-semibold tracking-tight text-zinc-100">{t('playlistModal.newPlaylist')}</h2>
          <p className="mt-1 text-ns-label text-zinc-500">{t('playlistModal.curateSounds')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            {errorMsg && (
              <p id="playlist-name-error" className="text-rose-300 text-sm font-semibold px-1" role="alert">{errorMsg}</p>
            )}
            <label htmlFor="playlist-name" className="sr-only">Playlist name</label>
            <input
              id="playlist-name"
              type="text"
              placeholder={t('playlistModal.playlistNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="ns-field w-full px-4 text-base placeholder-zinc-500 sm:text-sm"
              aria-invalid={Boolean(errorMsg)}
              aria-describedby={errorMsg ? 'playlist-name-error' : undefined}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="playlist-description" className="text-sm font-bold text-zinc-300">
              {t('playlists.description')} <span className="font-normal text-zinc-600">({t('playlists.optional')})</span>
            </label>
            <textarea
              id="playlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t('playlists.descriptionPlaceholder')}
              className="ns-field w-full resize-none px-4 py-3 text-base placeholder-zinc-500 sm:text-sm"
            />
            <p className="text-right text-ns-meta text-zinc-600">{description.length}/1000</p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border border-zinc-800 bg-zinc-900/40 px-3">
            <span>
              <strong className="block text-sm text-zinc-200">{t('playlists.public')}</strong>
              <small className="text-ns-meta text-zinc-500">{t('playlists.publicHelp')}</small>
            </span>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
              className="h-4 w-4 accent-[var(--ns-accent)]"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="ns-button-primary flex w-full cursor-pointer items-center justify-center space-x-2 rounded-md py-3 text-sm font-semibold"
          >
            <CheckCircle size={14} />
            <span>{isSubmitting ? t('playlistModal.creating') : t('playlistModal.createPlaylist')}</span>
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
