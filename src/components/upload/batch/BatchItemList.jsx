import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, GripVertical, RotateCcw } from 'lucide-react';
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
    <div className="space-y-2" data-testid="batch-item-list">
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
          className="ns-card p-3 sm:p-4"
        >
          <div className="flex items-center gap-3">
            <GripVertical size={16} className={item.target === 'PLAYLIST' ? 'text-zinc-600 cursor-grab' : 'text-zinc-800'} />
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 grid place-items-center text-xs text-zinc-500 shrink-0">{index + 1}</div>
            <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-zinc-200 truncate">{item.title}</p>
                {item.missingFields?.length > 0 && <AlertTriangle size={14} className="text-amber-300 shrink-0" />}
                {item.status === 'READY' && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
              </div>
              <p className="text-[11px] text-zinc-500 truncate">{item.fileName} · {formatBytes(item.fileSize)} · {item.genre ? getGenreLabel(item.genre, i18n.language) : t('batchUpload.missingGenre')}</p>
            </button>
            <span className={`hidden sm:inline-flex text-[10px] border rounded-full px-2 py-1 font-bold uppercase tracking-wider ${STATUS_STYLE[item.status] || 'text-zinc-400 border-zinc-700'}`}>{item.status}</span>
            <span className="w-28 sm:w-36 shrink-0">
              <select aria-label={`${item.title} ${t('batchUpload.target')}`} className="ns-field px-2 text-xs" value={item.target} onChange={(event) => onTarget(item, event.target.value)}>
                <option value="SINGLE">{t('batchUpload.single')}</option>
                <option value="PLAYLIST">{t('batchUpload.playlist')}</option>
                <option value="EXCLUDED">{t('batchUpload.excluded')}</option>
              </select>
            </span>
            {item.status === 'FAILED' ? (
              <button type="button" className="ns-icon-button" aria-label={t('batchUpload.retry')} onClick={() => onRetry(item)}><RotateCcw size={15} /></button>
            ) : (
              <button type="button" className="ns-icon-button" aria-label={t('batchUpload.editTrack')} onClick={() => onOpen(item)}><ChevronRight size={16} /></button>
            )}
          </div>
          {progress[item.id] != null && progress[item.id] < 100 && (
            <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-zinc-900" role="progressbar" aria-valuenow={progress[item.id]} aria-valuemin="0" aria-valuemax="100">
              <div className="h-full bg-brand-red transition-all" style={{ width: `${progress[item.id]}%` }} />
            </div>
          )}
          {item.errorMessage && <p role="alert" className="text-xs text-rose-300 mt-2 pl-12">{item.errorMessage}</p>}
        </div>
      ))}
    </div>
  );
}
