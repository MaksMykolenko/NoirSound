import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FileText, GripVertical, ImagePlus, ListMusic, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getGenreLabel } from '../../../utils/genreLabels';

export default function BatchPlaylistEditor({ batch, onSave, onOpenTrack, saving, stagedCover }) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(batch.playlist);
  const [coverFile, setCoverFile] = useState(stagedCover || null);
  const [orderedIds, setOrderedIds] = useState([]);
  const [draggedId, setDraggedId] = useState(null);

  const playlistItems = useMemo(() => batch.items
    .filter((item) => item.target === 'PLAYLIST')
    .sort((a, b) => (a.playlistOrder || 0) - (b.playlistOrder || 0)), [batch.items]);

  useEffect(() => {
    setForm(batch.playlist);
    setOrderedIds(playlistItems.map((item) => item.id));
  }, [batch.playlist, playlistItems]);

  const itemMap = useMemo(() => new Map(playlistItems.map((item) => [item.id, item])), [playlistItems]);
  const orderedItems = orderedIds.map((id) => itemMap.get(id)).filter(Boolean);
  const coverPreview = useMemo(() => coverFile ? URL.createObjectURL(coverFile) : '', [coverFile]);
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const move = (id, delta) => {
    setOrderedIds((current) => {
      const index = current.indexOf(id);
      const next = Math.max(0, Math.min(current.length - 1, index + delta));
      if (index < 0 || index === next) return current;
      const result = [...current];
      result.splice(index, 1);
      result.splice(next, 0, id);
      return result;
    });
  };

  const dropBefore = (id) => {
    if (!draggedId || draggedId === id) return;
    setOrderedIds((current) => {
      const result = current.filter((value) => value !== draggedId);
      result.splice(result.indexOf(id), 0, draggedId);
      return result;
    });
    setDraggedId(null);
  };

  return (
    <section className="space-y-5" data-testid="batch-playlist-editor">
      <div className="overflow-hidden rounded-md border border-zinc-800 bg-surface-noir/45">
        <div className="border-b border-zinc-800 bg-zinc-950/35 p-5 sm:p-6">
          <span className="ns-eyebrow text-brand-red">{t('batchUpload.playlistPreview')}</span>
          <div className="mt-4 flex flex-col md:flex-row gap-6 items-center md:items-end">
            <label className="grid h-48 w-48 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-dashed border-zinc-700 bg-zinc-900/80">
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
              {coverPreview ? <img src={coverPreview} alt="" className="w-full h-full object-cover" /> : (
                <div className="text-center text-zinc-500"><ImagePlus className="mx-auto mb-2" /><span className="text-xs">{batch.playlist.hasCover ? t('batchUpload.coverReady') : t('batchUpload.addCover')}</span></div>
              )}
            </label>
            <div className="flex-1 min-w-0 w-full space-y-3">
              <span className="inline-flex rounded border border-zinc-700 px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-wider text-zinc-300">
                {form.visibility === 'PUBLIC' ? t('batchUpload.public') : t('batchUpload.private')} · {t('batchUpload.draft')}
              </span>
              <input
                aria-label={t('batchUpload.playlistTitle')}
                className="w-full border-b border-zinc-700 bg-transparent py-2 text-2xl font-semibold text-zinc-100 outline-none focus:border-brand-red sm:text-3xl"
                placeholder={t('batchUpload.untitledPlaylist')}
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
              <p className="text-sm text-zinc-400">{t('batchUpload.by')} {batch.creator?.displayName || batch.creator?.username}</p>
              <textarea
                aria-label={t('batchUpload.description')}
                rows={2}
                className="w-full bg-transparent border-b border-zinc-800 focus:border-brand-red outline-none text-sm text-zinc-300 resize-none py-2"
                placeholder={t('batchUpload.playlistDescriptionPlaceholder')}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <select className="ns-field !rounded px-4" value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}>
                  <option value="PUBLIC">{t('batchUpload.public')}</option>
                  <option value="PRIVATE">{t('batchUpload.private')}</option>
                </select>
                <input className="ns-field !rounded px-4" placeholder={t('batchUpload.tags')} value={(form.tags || []).join(', ')} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-5">
          {orderedItems.length === 0 ? (
            <div className="py-14 text-center text-zinc-500">
              <ListMusic className="mx-auto mb-3" />
              <p className="text-sm">{t('batchUpload.noPlaylistTracks')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {orderedItems.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropBefore(item.id)}
                  className="group flex items-center gap-2 rounded border border-transparent p-2 hover:border-zinc-800 hover:bg-zinc-900/60"
                >
                  <GripVertical size={16} className="text-zinc-600 cursor-grab" />
                  <span className="w-6 text-center text-xs text-zinc-500">{index + 1}</span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenTrack(item)}>
                    <p className="text-sm font-bold text-zinc-200 truncate">{item.title || t('batchUpload.untitledTrack')}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{item.primaryArtistName} · {item.genre ? getGenreLabel(item.genre, i18n.language) : t('batchUpload.missingGenre')} · {item.status}</p>
                  </button>
                  {item.hasLyrics && (
                    <span className="inline-flex items-center gap-1 rounded border border-brand-red/25 bg-brand-red/10 px-2 py-1 font-mono text-[9px] font-medium text-brand-red">
                      <FileText size={11} /> {t('lyrics.title')}
                    </span>
                  )}
                  {item.missingFields?.length > 0 && <span className="rounded border border-amber-400/25 bg-amber-400/10 px-2 py-1 font-mono text-[9px] text-amber-300">{item.missingFields.length} {t('batchUpload.missing')}</span>}
                  <div className="flex gap-1">
                    <button type="button" className="ns-icon-button !rounded" aria-label={t('batchUpload.moveUp')} onClick={() => move(item.id, -1)} disabled={index === 0}><ArrowUp size={14} /></button>
                    <button type="button" className="ns-icon-button !rounded" aria-label={t('batchUpload.moveDown')} onClick={() => move(item.id, 1)} disabled={index === orderedItems.length - 1}><ArrowDown size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-500">{t('batchUpload.clickTrackHelp')}</p>
      <button
        type="button"
        className="ns-button-primary inline-flex !rounded items-center gap-2 px-5"
        disabled={saving || orderedItems.length === 0 || !form.title.trim()}
        onClick={() => onSave({
          title: form.title,
          description: form.description,
          visibility: form.visibility,
          tags: form.tags || [],
          orderedItemIds: orderedIds,
        }, coverFile)}
      >
        <Save size={16} /> {saving ? t('batchUpload.saving') : t('batchUpload.savePlaylist')}
      </button>
    </section>
  );
}
