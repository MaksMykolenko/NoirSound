import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, FileText, GripVertical, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getGenreLabel } from '../../../utils/genreLabels';
import { formatBytes } from './batchUploadUtils';

const STATUS_STYLE = {
  READY: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  PUBLISHED: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  FAILED: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  PROCESSING: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  UPLOADING: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  EXCLUDED: 'text-zinc-500 bg-zinc-800/50 border-zinc-700',
};

export default function BatchItemList({ items, onOpen, onTarget, onReorder, onRetry, progress = {} }) {
  const { t, i18n } = useTranslation();
  const [draggedId, setDraggedId] = useState(null);

  return (
    <div className="divide-y divide-zinc-800/70 border-y border-zinc-800/70" data-testid="batch-item-list">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable={item.target === 'PLAYLIST'}
          onDragStart={() => setDraggedId(item.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggedId && draggedId !== item.id) onReorder?.(draggedId, item.id);
            setDraggedId(null);
          }}
          className="py-3 transition-colors hover:bg-zinc-900/25 sm:px-2 sm:py-3.5"
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-center">
            <GripVertical size={16} className={`mt-3 sm:mt-0 ${item.target === 'PLAYLIST' ? 'cursor-grab text-zinc-600' : 'text-zinc-800'}`} />
            <div className="hidden h-9 w-9 shrink-0 place-items-center border-r border-zinc-800 font-sans tabular-nums text-ns-meta text-zinc-500 sm:grid">{index + 1}</div>
            <button type="button" onClick={() => onOpen(item)} className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-ns-meta text-zinc-600 sm:hidden">{index + 1}</span>
                <p className="truncate text-sm font-bold text-zinc-200">{item.title}</p>
                {item.missingFields?.length > 0 && <AlertTriangle size={14} className="text-amber-300 shrink-0" />}
                {item.status === 'READY' && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                {item.hasLyrics && <FileText size={14} className="text-brand-red shrink-0" aria-label={t('lyrics.title')} />}
              </div>
              <p className="truncate font-sans tabular-nums text-ns-meta text-zinc-500">{item.fileName} · {formatBytes(item.fileSize)} · {item.genre ? getGenreLabel(item.genre, i18n.language) : t('batchUpload.missingGenre')}</p>
              <p className="truncate font-sans tabular-nums text-ns-meta text-zinc-600">
                {item.hasLyrics
                  ? `${t('batchUpload.lyricsAdded')} · ${item.lyricsRightsConfirmed ? t('batchUpload.lyricsRightsConfirmed') : t('lyrics.rightsRequired')}`
                  : t('batchUpload.noLyrics')}
              </p>
            </button>
            <div className="col-span-2 flex min-w-0 items-center gap-2 pl-7 sm:col-span-1 sm:pl-0">
              <span className={`hidden rounded border px-2 py-1 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label md:inline-flex ${STATUS_STYLE[item.status] || 'text-zinc-400 border-zinc-700'}`}>{item.status}</span>
              <label className="min-w-0 flex-1 sm:w-32 sm:flex-none md:w-36">
                <span className="sr-only">{t('batchUpload.target')}</span>
                <select aria-label={`${item.title} ${t('batchUpload.target')}`} className="ns-field w-full !rounded px-2 text-base sm:text-sm" value={item.target} onChange={(event) => onTarget(item, event.target.value)}>
                  <option value="SINGLE">{t('batchUpload.single')}</option>
                  <option value="PLAYLIST">{t('batchUpload.playlist')}</option>
                  <option value="EXCLUDED">{t('batchUpload.excluded')}</option>
                </select>
              </label>
              {item.status === 'FAILED' ? (
                <button type="button" className="ns-icon-button !rounded" aria-label={t('batchUpload.retry')} onClick={() => onRetry(item)}><RotateCcw size={15} /></button>
              ) : (
                <button type="button" className="ns-icon-button !rounded" aria-label={t('batchUpload.editTrack')} onClick={() => onOpen(item)}><ChevronRight size={16} /></button>
              )}
            </div>
          </div>
          {progress[item.id] != null && progress[item.id] < 100 && (
            <div className="ml-7 mt-3 h-1.5 overflow-hidden rounded-sm bg-zinc-900 sm:ml-20" role="progressbar" aria-valuenow={progress[item.id]} aria-valuemin="0" aria-valuemax="100">
              <div className="h-full bg-brand-red transition-all" style={{ width: `${progress[item.id]}%` }} />
            </div>
          )}
          {item.errorMessage && <p role="alert" className="ml-7 mt-2 text-sm text-rose-300 sm:ml-20">{item.errorMessage}</p>}
        </div>
      ))}
    </div>
  );
}
