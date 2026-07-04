import React, { useRef, useState } from 'react';
import { FileAudio, FolderPlus, Trash2, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BATCH_MAX_FILES, validateSelectedFiles, formatBytes } from './batchUploadUtils';

export default function BatchFileDropzone({
  stagedFiles,
  onFiles,
  onRemove,
  onCreate,
  creating,
  mode,
  onModeChange,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const totalBytes = stagedFiles.reduce((sum, entry) => sum + entry.file.size, 0);
  const duplicateNames = new Set(stagedFiles
    .filter((entry, index, all) => all.findIndex((candidate) => candidate.file.name === entry.file.name) !== index)
    .map((entry) => entry.file.name));

  const accept = (fileList) => {
    const result = validateSelectedFiles([...fileList], stagedFiles.length, totalBytes);
    setErrors(result.errors);
    onFiles(result.accepted);
  };

  return (
    <section className="space-y-5" data-testid="batch-file-stage">
      <div
        className={`min-h-64 rounded-[1.75rem] border-2 border-dashed p-7 flex flex-col items-center justify-center text-center transition-colors ${
          dragging ? 'border-brand-red bg-brand-red/10' : 'border-zinc-700 bg-zinc-950/40 hover:border-zinc-600'
        }`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".mp3,.wav,.flac,.aac,.ogg,audio/mpeg,audio/wav,audio/flac,audio/aac,audio/ogg"
          className="sr-only"
          aria-label={t('batchUpload.selectFiles')}
          onChange={(event) => accept(event.target.files)}
        />
        <div className="w-16 h-16 rounded-2xl bg-brand-red/10 border border-brand-red/30 text-brand-red grid place-items-center mb-5">
          <UploadCloud size={30} />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">{t('batchUpload.selectFiles')}</h2>
        <p className="text-sm text-zinc-400 mt-2 max-w-md">{t('batchUpload.dropHelp')}</p>
        <button
          type="button"
          className="ns-button-primary px-5 mt-5 inline-flex items-center gap-2"
          onClick={() => inputRef.current?.click()}
        >
          <FolderPlus size={16} />
          {t('batchUpload.chooseAudio')}
        </button>
        <p className="text-[11px] text-zinc-500 mt-4">{t('batchUpload.limits')}</p>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      {stagedFiles.length > 0 && (
        <div className="ns-card p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-zinc-100">{stagedFiles.length} / {BATCH_MAX_FILES} {t('batchUpload.filesSelected')}</h3>
              <p className="text-xs text-zinc-500">{formatBytes(totalBytes)} / 500 MB</p>
            </div>
            <label className="text-xs text-zinc-400">
              <span className="block mb-1 font-bold uppercase tracking-wider">{t('batchUpload.batchMode')}</span>
              <select className="ns-field px-3 min-w-44" value={mode} onChange={(event) => onModeChange(event.target.value)}>
                <option value="MIXED">{t('batchUpload.mixed')}</option>
                <option value="SINGLES_ONLY">{t('batchUpload.singlesOnly')}</option>
                <option value="PLAYLIST">{t('batchUpload.playlistOnly')}</option>
              </select>
            </label>
          </div>
          <div className="space-y-2">
            {stagedFiles.map((entry) => (
              <div key={entry.clientId} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                <FileAudio size={18} className="text-brand-red shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-200 truncate">{entry.file.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {formatBytes(entry.file.size)} · {entry.file.type || 'Unknown MIME'}
                    {duplicateNames.has(entry.file.name) && <span className="text-amber-300"> · {t('batchUpload.duplicateWarning')}</span>}
                  </p>
                </div>
                <button type="button" className="ns-icon-button" aria-label={`${t('actions.remove')} ${entry.file.name}`} onClick={() => onRemove(entry.clientId)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="w-full ns-button-primary px-5" disabled={creating} onClick={onCreate}>
            {creating ? t('batchUpload.creatingDraft') : t('batchUpload.createDraft')}
          </button>
        </div>
      )}
    </section>
  );
}
