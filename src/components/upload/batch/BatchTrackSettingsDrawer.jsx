import React, { useEffect, useMemo, useState } from 'react';
import { FileAudio, ImagePlus, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GenrePicker from '../../ui/GenrePicker';
import { formatBytes } from './batchUploadUtils';

export default function BatchTrackSettingsDrawer({ item, open, onClose, onSave, saving, stagedCover }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  useEffect(() => {
    if (!item) return;
    setForm({
      title: item.title || '',
      primaryArtistName: item.primaryArtistName || '',
      featuredArtists: (item.featuredArtists || []).join(', '),
      genre: item.genre || '',
      tags: (item.tags || []).join(', '),
      description: item.description || '',
      explicit: Boolean(item.explicit),
      visibility: item.visibility || 'PUBLIC',
      copyrightConfirmed: Boolean(item.copyrightConfirmed),
      target: item.target || 'SINGLE',
      playlistOrder: item.playlistOrder || 1,
    });
    setCoverFile(stagedCover || null);
  }, [item, stagedCover]);

  const coverPreview = useMemo(() => {
    if (!coverFile) return '';
    return URL.createObjectURL(coverFile);
  }, [coverFile]);
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  if (!open || !item || !form) return null;
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    await onSave({
      title: form.title,
      primaryArtistName: form.primaryArtistName,
      featuredArtists: form.featuredArtists.split(',').map((value) => value.trim()).filter(Boolean),
      genre: form.genre || null,
      tags: form.tags.split(',').map((value) => value.trim()).filter(Boolean),
      description: form.description,
      explicit: form.explicit,
      visibility: form.visibility,
      copyrightConfirmed: form.copyrightConfirmed,
      target: form.target,
      playlistOrder: form.target === 'PLAYLIST' ? Number(form.playlistOrder) || 1 : null,
    }, coverFile);
  };

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label={t('actions.close')} onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-track-settings-title"
        className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[1.75rem] border border-zinc-800 bg-brand-black p-5 shadow-2xl sm:inset-y-0 sm:left-auto sm:w-[min(44rem,92vw)] sm:max-h-none sm:rounded-none sm:border-y-0 sm:border-r-0"
      >
        <div className="flex items-center justify-between gap-4 sticky top-0 z-10 bg-brand-black pb-4 border-b border-zinc-800">
          <div>
            <span className="ns-eyebrow text-brand-red">{t('batchUpload.trackSettings')}</span>
            <h2 id="batch-track-settings-title" className="text-xl font-bold text-zinc-100 mt-1">{form.title || t('batchUpload.untitledTrack')}</h2>
          </div>
          <button type="button" className="ns-icon-button" aria-label={t('actions.close')} onClick={onClose}><X size={20} /></button>
        </div>

        <div className="space-y-5 py-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 flex items-center gap-3">
            <FileAudio className="text-brand-red" size={20} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-200 truncate">{item.fileName}</p>
              <p className="text-[11px] text-zinc-500">{formatBytes(item.fileSize)} · {item.mimeType} · {item.durationSeconds ? `${item.durationSeconds}s` : t('batchUpload.durationPending')}</p>
            </div>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-zinc-400">{item.status}</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('batchUpload.trackTitle')}</span>
              <input className="ns-field px-4" value={form.title} onChange={(event) => set('title', event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('batchUpload.primaryArtist')}</span>
              <input className="ns-field px-4" value={form.primaryArtistName} onChange={(event) => set('primaryArtistName', event.target.value)} />
            </label>
          </div>
          <label className="space-y-1.5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('batchUpload.featuredArtists')}</span>
            <input className="ns-field px-4" value={form.featuredArtists} onChange={(event) => set('featuredArtists', event.target.value)} placeholder={t('batchUpload.commaSeparated')} />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('batchUpload.genre')}</span>
              <GenrePicker value={form.genre} onChange={(value) => set('genre', value)} id={`batch-genre-${item.id}`} />
            </div>
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('batchUpload.tags')}</span>
              <input className="ns-field px-4" value={form.tags} onChange={(event) => set('tags', event.target.value)} placeholder={t('batchUpload.commaSeparated')} />
            </label>
          </div>
          <label className="space-y-1.5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('batchUpload.description')}</span>
            <textarea rows={4} className="ns-field px-4 py-3 resize-none" value={form.description} onChange={(event) => set('description', event.target.value)} />
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('batchUpload.target')}</span>
              <select aria-label={t('batchUpload.target')} className="ns-field px-4" value={form.target} onChange={(event) => set('target', event.target.value)}>
                <option value="SINGLE">{t('batchUpload.standaloneSingle')}</option>
                <option value="PLAYLIST">{t('batchUpload.addToPlaylist')}</option>
                <option value="EXCLUDED">{t('batchUpload.exclude')}</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('batchUpload.visibility')}</span>
              <select className="ns-field px-4" value={form.visibility} onChange={(event) => set('visibility', event.target.value)}>
                <option value="PUBLIC">{t('batchUpload.public')}</option>
                <option value="PRIVATE">{t('batchUpload.private')}</option>
              </select>
            </label>
          </div>
          {form.target === 'PLAYLIST' && (
            <label className="space-y-1.5 block">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('batchUpload.playlistOrder')}</span>
              <input type="number" min="1" className="ns-field px-4" value={form.playlistOrder} onChange={(event) => set('playlistOrder', event.target.value)} />
            </label>
          )}

          <label className="rounded-2xl border border-dashed border-zinc-700 p-4 flex items-center gap-4 cursor-pointer">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
            {coverPreview ? <img src={coverPreview} alt="" className="w-16 h-16 rounded-xl object-cover" /> : <div className="w-16 h-16 rounded-xl bg-zinc-900 grid place-items-center"><ImagePlus className="text-zinc-500" /></div>}
            <div>
              <p className="text-sm font-bold text-zinc-200">{t('batchUpload.cover')}</p>
              <p className="text-xs text-zinc-500">{coverFile?.name || (item.hasCover ? t('batchUpload.coverReady') : t('batchUpload.coverOptional'))}</p>
            </div>
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="rounded-xl border border-zinc-800 p-4 flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.explicit} onChange={(event) => set('explicit', event.target.checked)} className="w-5 h-5 accent-brand-red" />
              <span className="text-sm text-zinc-300">{t('batchUpload.explicit')}</span>
            </label>
            <label className="rounded-xl border border-zinc-800 p-4 flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.copyrightConfirmed} onChange={(event) => set('copyrightConfirmed', event.target.checked)} className="w-5 h-5 accent-brand-red mt-0.5" />
              <span className="text-sm text-zinc-300">{t('batchUpload.copyright')}</span>
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 bg-brand-black pt-4 border-t border-zinc-800">
          <button type="button" className="w-full ns-button-primary px-5 inline-flex items-center justify-center gap-2" disabled={saving} onClick={save}>
            <Save size={16} /> {saving ? t('batchUpload.saving') : t('batchUpload.saveDraft')}
          </button>
        </div>
      </section>
    </div>
  );
}
