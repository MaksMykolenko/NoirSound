import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, LoaderCircle, Save, X } from 'lucide-react';
import { updatePlaylist, uploadPlaylistCover } from '../../api';
import { useTranslation } from 'react-i18next';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';

const ALLOWED_COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_COVER_SIZE = 5 * 1024 * 1024;

export default function EditPlaylistModal({ playlist, isOpen, onClose, onSaved }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [cover, setCover] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialogFocusTrap(isOpen && !saving, onClose);

  useEffect(() => {
    if (!isOpen || !playlist) return;
    setName(playlist.name || '');
    setDescription(playlist.description || '');
    setIsPublic(playlist.isPublic !== false);
    setCover(null);
    setError('');
  }, [isOpen, playlist]);

  if (!isOpen || !playlist) return null;

  const handleCover = (event) => {
    const file = event.target.files?.[0] || null;
    setError('');
    if (!file) {
      setCover(null);
      return;
    }
    if (!ALLOWED_COVER_TYPES.has(file.type)) {
      setError('Cover must be a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_COVER_SIZE) {
      setError('Cover must be no larger than 5 MB.');
      return;
    }
    setCover(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Playlist name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let updated = await updatePlaylist(playlist.id, {
        name: cleanName,
        description: description.trim(),
        isPublic,
      });
      if (cover) updated = await uploadPlaylistCover(playlist.id, cover);
      onSaved(updated);
      window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
      onClose();
    } catch (requestError) {
      setError(requestError.message || 'Playlist could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[var(--ns-z-confirmation)] flex items-center justify-center bg-black/75 p-4" onMouseDown={saving ? undefined : onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-playlist-title"
        className="w-full max-w-lg rounded-lg border border-zinc-700/70 bg-zinc-950 p-5 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h2 id="edit-playlist-title" className="text-lg font-semibold tracking-tight text-zinc-100">{t('playlists.edit')}</h2>
            <p className="font-mono text-[10px] text-zinc-500">{t('playlists.editHelp')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="ns-icon-button !min-h-10 !min-w-10" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-zinc-300">{t('playlists.name')}</span>
            <input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="ns-field w-full px-4 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-zinc-300">{t('playlists.description')}</span>
            <textarea maxLength={1000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="ns-field w-full resize-none px-4 py-3 text-sm" />
            <span className="block text-right text-[10px] text-zinc-600">{description.length}/1000</span>
          </label>
          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-md border border-zinc-800 bg-zinc-900/40 px-4">
            <span>
              <strong className="block text-xs text-zinc-200">{t('playlists.public')}</strong>
              <small className="text-zinc-500">{t('playlists.privateHelp')}</small>
            </span>
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-4 w-4 accent-[var(--ns-accent)]" />
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-dashed border-zinc-700 px-4 text-sm text-zinc-300 hover:border-zinc-500">
            <ImagePlus size={17} className="text-brand-red" />
            <span className="min-w-0 flex-1 truncate">{cover?.name || t('playlists.coverHelp')}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCover} className="sr-only" />
          </label>
          {error && <p role="alert" className="text-xs font-semibold text-rose-300">{error}</p>}
          <button type="submit" disabled={saving} className="ns-button-primary flex min-h-12 w-full items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t('playlists.saving') : t('playlists.saveChanges')}
          </button>
        </form>
      </section>
    </div>,
    document.body
  );
}
