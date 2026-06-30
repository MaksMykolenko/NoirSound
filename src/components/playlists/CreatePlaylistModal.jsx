import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, ListMusic, CheckCircle } from 'lucide-react';

export default function CreatePlaylistModal({ isOpen, onClose, onCreate }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Playlist name is required.');
      return;
    }
    if (name.trim().length > 50) {
      setErrorMsg('Playlist name must be under 50 characters.');
      return;
    }
    try {
      setIsSubmitting(true);
      await onCreate(name.trim());
      setName('');
    } catch (error) {
      setErrorMsg(error.message || 'Playlist could not be created.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-brand-dark border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] relative" role="dialog" aria-modal="true" aria-labelledby="playlist-modal-title">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 ns-icon-button !min-h-10 !min-w-10 cursor-pointer"
          aria-label="Close create playlist dialog"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center mb-3">
            <ListMusic size={20} className="text-brand-red" />
          </div>
          <h2 id="playlist-modal-title" className="text-xl font-bold text-zinc-100">{t('playlistModal.newPlaylist')}</h2>
          <p className="text-xs text-zinc-400 mt-1">{t('playlistModal.curateSounds')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            {errorMsg && (
              <p id="playlist-name-error" className="text-rose-300 text-xs font-semibold px-1" role="alert">{errorMsg}</p>
            )}
            <label htmlFor="playlist-name" className="sr-only">Playlist name</label>
            <input
              id="playlist-name"
              type="text"
              placeholder={t('playlistModal.playlistNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ns-field w-full px-4 text-sm placeholder-zinc-500"
              aria-invalid={Boolean(errorMsg)}
              aria-describedby={errorMsg ? 'playlist-name-error' : undefined}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 ns-button-primary rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center space-x-2 cursor-pointer"
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
