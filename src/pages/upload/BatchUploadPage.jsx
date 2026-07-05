import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileAudio,
  LoaderCircle,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  cancelBatchUpload,
  completeBatchUpload,
  createBatchUpload,
  getBatchUpload,
  listMyBatchUploads,
  publishBatchUpload,
  retryBatchItem,
  updateBatchItem,
  updateBatchPlaylist,
  uploadBatchAudioFiles,
  uploadBatchItemCover,
  uploadBatchPlaylistCover,
} from '../../api/uploads';
import BatchFileDropzone from '../../components/upload/batch/BatchFileDropzone';
import BatchItemList from '../../components/upload/batch/BatchItemList';
import BatchPlaylistEditor from '../../components/upload/batch/BatchPlaylistEditor';
import BatchTrackSettingsDrawer from '../../components/upload/batch/BatchTrackSettingsDrawer';
import LoadingState from '../../components/ui/LoadingState';
import { useToastStore } from '../../store/toastStore';
import { useUserStore } from '../../store/userStore';

const STEP_KEYS = ['selectFiles', 'sortTracks', 'editMetadata', 'configurePlaylist', 'review', 'uploadPublish'];

function localId() {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function activeItems(batch) {
  return batch?.items?.filter((item) => item.target !== 'EXCLUDED') || [];
}

export default function BatchUploadPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, authHydrated, setAuthModalOpen } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  const reselectRef = useRef(null);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [mode, setMode] = useState('MIXED');
  const [batch, setBatch] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [filesByItemId, setFilesByItemId] = useState({});
  const [trackCovers, setTrackCovers] = useState({});
  const [playlistCover, setPlaylistCover] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState('');
  const [uploadProgress, setUploadProgress] = useState({});
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const reloadBatch = async (batchId = batch?.id) => {
    if (!batchId) return null;
    const response = await getBatchUpload(batchId);
    setBatch(response.batch);
    if (selectedItem) {
      setSelectedItem(response.batch.items.find((item) => item.id === selectedItem.id) || null);
    }
    return response.batch;
  };

  useEffect(() => {
    if (!authHydrated || !user || !['ARTIST', 'ADMIN'].includes(user.role) || user.canUploadTracks === false) return;
    let cancelled = false;
    const batchId = searchParams.get('batch');
    setLoadingDrafts(true);
    Promise.all([
      listMyBatchUploads(),
      batchId ? getBatchUpload(batchId) : Promise.resolve(null),
    ]).then(([list, resumed]) => {
      if (cancelled) return;
      setDrafts(list.data || []);
      if (resumed?.batch) {
        setBatch(resumed.batch);
        setStep(1);
      }
    }).catch((error) => addToast(error.message, 'error'))
      .finally(() => !cancelled && setLoadingDrafts(false));
    return () => { cancelled = true; };
  }, [addToast, authHydrated, searchParams, user]);

  const hasProcessingItems = Boolean(batch?.items?.some((item) => item.status === 'PROCESSING'));
  useEffect(() => {
    if (!batch?.id || !hasProcessingItems) return undefined;
    const timer = setInterval(() => {
      getBatchUpload(batch.id)
        .then((response) => setBatch(response.batch))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [batch?.id, hasProcessingItems]);

  const counts = useMemo(() => {
    const items = batch?.items || [];
    return {
      files: items.length,
      singles: items.filter((item) => item.target === 'SINGLE').length,
      playlist: items.filter((item) => item.target === 'PLAYLIST').length,
      excluded: items.filter((item) => item.target === 'EXCLUDED').length,
      ready: items.filter((item) => item.status === 'READY').length,
      processing: items.filter((item) => item.status === 'PROCESSING').length,
      failed: items.filter((item) => item.status === 'FAILED').length,
      published: items.filter((item) => item.status === 'PUBLISHED').length,
      lyrics: items.filter((item) => item.hasLyrics).length,
    };
  }, [batch]);

  const addStagedFiles = (files) => {
    setStagedFiles((current) => [
      ...current,
      ...files.map((file) => ({ clientId: localId(), file })),
    ]);
  };

  const createDraft = async () => {
    setBusy('create');
    try {
      const initialized = await createBatchUpload(stagedFiles, mode);
      const response = await getBatchUpload(initialized.batchId);
      const localFiles = {};
      response.batch.items.forEach((item) => {
        const staged = stagedFiles.find((entry) => entry.clientId === item.clientId);
        if (staged) localFiles[item.id] = staged.file;
      });
      setFilesByItemId(localFiles);
      setBatch(response.batch);
      setSearchParams({ batch: response.batch.id });
      setStep(1);
      addToast(t('batchUpload.draftCreated'), 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const attachReselectedFiles = (fileList) => {
    const next = { ...filesByItemId };
    const unmatched = [];
    for (const file of [...fileList]) {
      const item = batch.items.find((candidate) =>
        candidate.fileName === file.name
        && candidate.fileSize === file.size
        && !next[candidate.id]
      );
      if (item) next[item.id] = file;
      else unmatched.push(file.name);
    }
    setFilesByItemId(next);
    if (unmatched.length) addToast(`${t('batchUpload.unmatchedFiles')}: ${unmatched.join(', ')}`, 'error');
  };

  const saveItem = async (updates, coverFile) => {
    if (!selectedItem) return;
    setBusy('save-item');
    try {
      const response = await updateBatchItem(batch.id, selectedItem.id, updates);
      setBatch(response.batch);
      if (coverFile) setTrackCovers((current) => ({ ...current, [selectedItem.id]: coverFile }));
      setSelectedItem(null);
      addToast(t('batchUpload.trackSaved'), 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const changeTarget = async (item, target) => {
    try {
      const response = await updateBatchItem(batch.id, item.id, { target });
      setBatch(response.batch);
    } catch (error) {
      addToast(error.message, 'error');
    }
  };

  const reorder = async (draggedId, beforeId) => {
    const playlist = batch.items
      .filter((item) => item.target === 'PLAYLIST')
      .sort((a, b) => (a.playlistOrder || 0) - (b.playlistOrder || 0))
      .map((item) => item.id)
      .filter((id) => id !== draggedId);
    playlist.splice(playlist.indexOf(beforeId), 0, draggedId);
    try {
      const response = await updateBatchPlaylist(batch.id, { orderedItemIds: playlist });
      setBatch(response.batch);
    } catch (error) {
      addToast(error.message, 'error');
    }
  };

  const savePlaylist = async (updates, coverFile) => {
    setBusy('save-playlist');
    try {
      const response = await updateBatchPlaylist(batch.id, updates);
      setBatch(response.batch);
      if (coverFile) setPlaylistCover(coverFile);
      addToast(t('batchUpload.playlistSaved'), 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const startUpload = async () => {
    if (batch.missingFields.length > 0) {
      addToast(t('batchUpload.fixBlockingErrors'), 'error');
      setStep(4);
      return;
    }
    const needsLocalFile = activeItems(batch).filter((item) =>
      !['PROCESSING', 'READY', 'PUBLISHED'].includes(item.status) && !filesByItemId[item.id]
    );
    if (needsLocalFile.length > 0) {
      addToast(t('batchUpload.reselectRequired'), 'error');
      reselectRef.current?.click();
      return;
    }
    setBusy('upload');
    setStep(5);
    try {
      for (const [itemId, cover] of Object.entries(trackCovers)) {
        await uploadBatchItemCover(batch.id, itemId, cover);
      }
      if (playlistCover) await uploadBatchPlaylistCover(batch.id, playlistCover);
      await uploadBatchAudioFiles(batch.id, filesByItemId, (itemId, percent) =>
        setUploadProgress((current) => ({ ...current, [itemId]: percent }))
      );
      const response = await completeBatchUpload(batch.id);
      setBatch(response.batch);
      addToast(t('batchUpload.processingStarted'), 'success');
    } catch (error) {
      addToast(error.message, 'error');
      await reloadBatch().catch(() => {});
    } finally {
      setBusy('');
    }
  };

  const retry = async (item) => {
    setBusy(`retry-${item.id}`);
    try {
      await retryBatchItem(batch.id, item.id);
      await reloadBatch();
      addToast(t('batchUpload.retryStarted'), 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const publish = async (allowPartial) => {
    setBusy(allowPartial ? 'publish-partial' : 'publish');
    try {
      const response = await publishBatchUpload(batch.id, allowPartial);
      setBatch(response.batch);
      addToast(response.partial ? t('batchUpload.partialPublished') : t('batchUpload.published'), 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    try {
      await cancelBatchUpload(batch.id);
      setBatch(null);
      setStagedFiles([]);
      setFilesByItemId({});
      setSearchParams({});
      setStep(0);
      addToast(t('batchUpload.cancelled'), 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  if (!authHydrated) return <LoadingState type="list" count={4} />;
  if (!user) {
    return (
      <div className="max-w-lg mx-auto ns-state-panel text-center space-y-4">
        <AlertCircle className="mx-auto text-amber-300" />
        <h1 className="text-xl font-bold text-zinc-100">{t('batchUpload.signInRequired')}</h1>
        <button type="button" className="ns-button-primary px-5" onClick={() => setAuthModalOpen(true)}>{t('header.signIn')}</button>
      </div>
    );
  }
  if (!['ARTIST', 'ADMIN'].includes(user.role) || user.canUploadTracks === false) {
    return (
      <div className="max-w-lg mx-auto ns-state-panel text-center space-y-3">
        <AlertCircle className="mx-auto text-amber-300" />
        <h1 className="text-xl font-bold text-zinc-100">{t('batchUpload.creatorRequired')}</h1>
        <p className="text-sm text-zinc-400">{t('batchUpload.creatorRequiredHelp')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-7 animate-fade-in pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/upload" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-200">
            <ArrowLeft size={14} /> {t('batchUpload.singleTrack')}
          </Link>
          <span className="ns-eyebrow text-brand-red block mt-4">{t('batchUpload.multiUpload')}</span>
          <h1 className="ns-page-title mt-2">{t('batchUpload.title')}</h1>
          <p className="ns-page-lede mt-2 max-w-2xl">{t('batchUpload.subtitle')}</p>
        </div>
        {batch && (
          <div className="flex gap-2">
            <input
              ref={reselectRef}
              type="file"
              multiple
              accept=".mp3,.wav,.flac,.aac,.ogg"
              className="sr-only"
              onChange={(event) => attachReselectedFiles(event.target.files)}
            />
            <button type="button" className="ns-button-secondary px-4 inline-flex items-center gap-2" onClick={() => reselectRef.current?.click()}>
              <RotateCcw size={14} /> {t('batchUpload.reselectFiles')}
            </button>
            {!batch.items.some((item) => item.status === 'PUBLISHED') && (
              <button type="button" className="ns-button-secondary px-4 text-rose-300 inline-flex items-center gap-2" disabled={busy === 'cancel'} onClick={cancel}>
                <Trash2 size={14} /> {t('batchUpload.cancelBatch')}
              </button>
            )}
          </div>
        )}
      </div>

      <nav aria-label={t('batchUpload.steps')} className="ns-card p-2 overflow-x-auto ns-tabs-scroll">
        <ol className="flex min-w-max">
          {STEP_KEYS.map((key, index) => (
            <li key={key}>
              <button
                type="button"
                disabled={!batch && index > 0}
                onClick={() => setStep(index)}
                className={`min-h-11 px-3 sm:px-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  step === index ? 'bg-brand-red text-white' : index < step ? 'text-emerald-300' : 'text-zinc-500'
                } disabled:opacity-35`}
              >
                <span>{index < step ? '✓' : index + 1}</span>
                {t(`batchUpload.${key}`)}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {step === 0 && !batch && (
        <div className="space-y-6">
          <BatchFileDropzone
            stagedFiles={stagedFiles}
            onFiles={addStagedFiles}
            onRemove={(clientId) => setStagedFiles((current) => current.filter((entry) => entry.clientId !== clientId))}
            onCreate={createDraft}
            creating={busy === 'create'}
            mode={mode}
            onModeChange={setMode}
          />
          {loadingDrafts ? <LoadingState type="list" count={2} /> : drafts.length > 0 && (
            <section className="space-y-3">
              <h2 className="ns-eyebrow">{t('batchUpload.resumeDraft')}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {drafts.filter((draft) => draft.status !== 'PUBLISHED').map((draft) => (
                  <button key={draft.id} type="button" className="ns-card p-4 text-left hover:border-brand-red/40" onClick={() => setSearchParams({ batch: draft.id })}>
                    <p className="font-bold text-zinc-200 truncate">{draft.playlistTitle || `${draft.itemCount} ${t('batchUpload.trackDrafts')}`}</p>
                    <p className="text-xs text-zinc-500 mt-1">{draft.status} · {draft.readyCount} {t('batchUpload.ready')} · {draft.failedCount} {t('batchUpload.failed')}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {batch && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_19rem] gap-6">
          <main className="min-w-0">
            {(step === 1 || step === 2) && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100">{step === 1 ? t('batchUpload.sortTracks') : t('batchUpload.editMetadata')}</h2>
                  <p className="text-sm text-zinc-500 mt-1">{step === 1 ? t('batchUpload.sortHelp') : t('batchUpload.editHelp')}</p>
                </div>
                <BatchItemList
                  items={batch.items}
                  onOpen={setSelectedItem}
                  onTarget={changeTarget}
                  onReorder={reorder}
                  onRetry={retry}
                  progress={uploadProgress}
                />
                <div className="flex justify-end">
                  <button type="button" className="ns-button-primary px-5" onClick={() => setStep(step + 1)}>
                    {t('actions.continue')}
                  </button>
                </div>
              </section>
            )}

            {step === 3 && (
              <BatchPlaylistEditor
                batch={batch}
                onSave={savePlaylist}
                onOpenTrack={setSelectedItem}
                saving={busy === 'save-playlist'}
                stagedCover={playlistCover}
              />
            )}

            {step === 4 && (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100">{t('batchUpload.review')}</h2>
                  <p className="text-sm text-zinc-500 mt-1">{t('batchUpload.reviewHelp')}</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    [counts.files, t('batchUpload.filesSelected')],
                    [counts.singles, t('batchUpload.standaloneSingles')],
                    [counts.playlist, t('batchUpload.playlistTracks')],
                    [counts.excluded, t('batchUpload.excluded')],
                    [counts.lyrics, t('batchUpload.lyricsAdded')],
                    [batch.missingFields.length, t('batchUpload.blockingErrors')],
                  ].map(([value, label]) => (
                    <div key={label} className="ns-card p-4"><p className="text-2xl font-black text-zinc-100">{value}</p><p className="text-xs text-zinc-500 mt-1">{label}</p></div>
                  ))}
                </div>
                {batch.missingFields.length > 0 ? (
                  <div role="alert" className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">
                    <p className="font-bold">{t('batchUpload.fixBlockingErrors')}</p>
                    <ul className="mt-2 space-y-1 list-disc pl-5">
                      {batch.missingFields.map((missing, index) => (
                        <li key={`${missing.itemId || 'playlist'}-${missing.field}-${index}`}>
                          {missing.scope === 'playlist' ? t('batchUpload.playlistSettings') : batch.items.find((item) => item.id === missing.itemId)?.title}: {missing.field}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex items-center gap-3">
                    <CheckCircle2 size={20} /> {t('batchUpload.readyToUpload')}
                  </div>
                )}
                <BatchItemList items={batch.items} onOpen={setSelectedItem} onTarget={changeTarget} onReorder={reorder} onRetry={retry} progress={uploadProgress} />
                <button type="button" className="w-full ns-button-primary px-5 inline-flex items-center justify-center gap-2" disabled={busy === 'upload' || batch.missingFields.length > 0} onClick={startUpload}>
                  <Send size={16} /> {busy === 'upload' ? t('batchUpload.uploading') : t('batchUpload.startUpload')}
                </button>
              </section>
            )}

            {step === 5 && (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100">{t('batchUpload.uploadPublish')}</h2>
                  <p className="text-sm text-zinc-500 mt-1">{t('batchUpload.processingHelp')}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    [counts.processing, t('batchUpload.processing'), LoaderCircle],
                    [counts.ready, t('batchUpload.ready'), CheckCircle2],
                    [counts.failed, t('batchUpload.failed'), AlertCircle],
                    [counts.published, t('batchUpload.publishedLabel'), Send],
                  ].map(([value, label, Icon]) => (
                    <div key={label} className="ns-card p-4">
                      <Icon size={17} className="text-brand-red mb-3" />
                      <p className="text-2xl font-black text-zinc-100">{value}</p>
                      <p className="text-xs text-zinc-500">{label}</p>
                    </div>
                  ))}
                </div>
                <BatchItemList items={batch.items} onOpen={setSelectedItem} onTarget={changeTarget} onReorder={reorder} onRetry={retry} progress={uploadProgress} />
                {batch.status !== 'PUBLISHED' && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button type="button" className="ns-button-primary px-5" disabled={!batch.canPublish || busy.startsWith('publish')} onClick={() => publish(false)}>
                      {busy === 'publish' ? t('batchUpload.publishing') : t('batchUpload.publishReady')}
                    </button>
                    <button type="button" className="ns-button-secondary px-5" disabled={!batch.canPublishPartial || counts.failed === 0 || busy.startsWith('publish')} onClick={() => publish(true)}>
                      {busy === 'publish-partial' ? t('batchUpload.publishing') : t('batchUpload.partialPublish')}
                    </button>
                  </div>
                )}
                {batch.status === 'PUBLISHED' && (
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-emerald-200">
                    <CheckCircle2 className="mb-3" />
                    <p className="font-bold">{t('batchUpload.publishComplete')}</p>
                    {batch.playlist.id && <Link className="inline-block mt-3 underline" to={`/playlist/${batch.playlist.id}`}>{t('batchUpload.openPlaylist')}</Link>}
                  </div>
                )}
              </section>
            )}
          </main>

          <aside className="space-y-4 xl:sticky xl:top-24 self-start">
            <div className="ns-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-zinc-100">{t('batchUpload.batchStatus')}</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-red">{batch.status}</span>
              </div>
              <div className="mt-4 space-y-2 text-xs text-zinc-400">
                <p className="flex justify-between"><span>{t('batchUpload.singles')}</span><strong className="text-zinc-200">{counts.singles}</strong></p>
                <p className="flex justify-between"><span>{t('batchUpload.playlistTracks')}</span><strong className="text-zinc-200">{counts.playlist}</strong></p>
                <p className="flex justify-between"><span>{t('batchUpload.ready')}</span><strong className="text-emerald-300">{counts.ready}</strong></p>
                <p className="flex justify-between"><span>{t('batchUpload.failed')}</span><strong className="text-rose-300">{counts.failed}</strong></p>
              </div>
            </div>
            <div className="ns-card p-3 space-y-1 max-h-[28rem] overflow-y-auto">
              {batch.items.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedItem(item)} className="w-full rounded-xl p-2.5 flex items-center gap-3 text-left hover:bg-zinc-900">
                  {item.status === 'PROCESSING' ? <LoaderCircle size={15} className="text-amber-300 animate-spin" /> : item.status === 'READY' || item.status === 'PUBLISHED' ? <CheckCircle2 size={15} className="text-emerald-400" /> : item.status === 'FAILED' ? <AlertCircle size={15} className="text-rose-400" /> : <FileAudio size={15} className="text-zinc-500" />}
                  <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-zinc-300 truncate">{item.title}</span><span className="block text-[10px] text-zinc-600">{item.target}</span></span>
                  {item.missingFields?.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                </button>
              ))}
            </div>
            <button type="button" className="w-full ns-button-secondary px-4 inline-flex items-center justify-center gap-2" onClick={() => reloadBatch()}>
              <Clock3 size={14} /> {t('batchUpload.refreshStatus')}
            </button>
          </aside>
        </div>
      )}

      <BatchTrackSettingsDrawer
        item={selectedItem}
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        onSave={saveItem}
        saving={busy === 'save-item'}
        stagedCover={selectedItem ? trackCovers[selectedItem.id] : null}
      />
    </div>
  );
}
