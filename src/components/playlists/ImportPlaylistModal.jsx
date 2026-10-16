import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import SourceTrackList from './SourceTrackList';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';
import { importStatus, previewImport, commitImport, connectSpotifyImport, disconnectSpotifyImport } from '../../api/playlistImport';

export default function ImportPlaylistModal({ onClose, onImported }) {
  const { t }=useTranslation();
  const [status,setStatus]=useState(null), [error,setError]=useState('');
  const [url,setUrl]=useState(()=>{try{return sessionStorage.getItem('noirsound.importUrl')||'';}catch{return '';}});
  const [preview,setPreview]=useState(null), [name,setName]=useState('');
  const [busy,setBusy]=useState(false), [saving,setSaving]=useState(false);
  const controller=useRef(null), requestId=useRef(crypto.randomUUID());
  const dialog=useDialogFocusTrap(true,()=>{if(!saving)onClose();});
  const showError=useCallback(err=>setError(t('playlistImport.errors.'+(err.code || 'IMPORT_FAILED'),{defaultValue:t('playlistImport.errors.IMPORT_FAILED')})),[t]);
  useEffect(()=>{
    const abort=new AbortController();
    importStatus(abort.signal).then(setStatus).catch(err=>{if(err.name!=='AbortError')showError(err);});
    return ()=>{abort.abort();controller.current?.abort();};
  },[showError]);
  const connect=async()=>{
    setError('');setBusy(true);
    try {sessionStorage.setItem('noirsound.importUrl',url);const {url:target}=await connectSpotifyImport();window.location.assign(target);}
    catch(err){showError(err);setBusy(false);}
  };
  const start=async event=>{
    event.preventDefault();setError('');setBusy(true);setPreview(null);
    controller.current?.abort();controller.current=new AbortController();const signal=controller.current.signal;
    requestId.current=crypto.randomUUID();
    try {
      const loaded=await previewImport({url:url.trim()},signal);
      if(signal.aborted)return;
      setPreview(loaded);setName(loaded.name);
      try{sessionStorage.removeItem('noirsound.importUrl');}catch{/* Optional resume. */}
    }catch(err){if(err.name!=='AbortError')showError(err);}
    finally{if(!signal.aborted)setBusy(false);}
  };
  const confirm=async()=>{
    setSaving(true);setError('');
    try {const result=await commitImport({mode:'source',preview:preview.preview,name:name.trim(),selections:preview.entries.map(entry=>entry.selection),requestId:requestId.current});onImported(result);}
    catch(err){showError(err);setSaving(false);}
  };
  return createPortal(<div className="fixed inset-0 z-[var(--ns-z-confirmation)] flex items-center justify-center bg-black/80 p-3 sm:p-5">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="playlist-import-title" className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 p-5">
        <div><h2 id="playlist-import-title" className="text-xl font-semibold">{t('playlistImport.title')}</h2><p className="mt-2 text-sm text-zinc-400">{t('playlistImport.help')}</p></div>
        <button type="button" disabled={saving} onClick={onClose} className="ns-icon-button shrink-0" aria-label={t('actions.close')}><X size={20}/></button>
      </header>
      <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5">
        <div hidden={Boolean(preview)} className="flex flex-wrap gap-2 text-xs">{['SPOTIFY','YOUTUBE','SOUNDCLOUD'].map(provider=><span key={provider} className="rounded border border-zinc-800 px-2 py-1">{provider==='YOUTUBE'?'YouTube':provider==='SOUNDCLOUD'?'SoundCloud':'Spotify'} · {status?t(status.providers[provider]?'playlistImport.available':'playlistImport.unconfigured'):t('playlistImport.loading')}</span>)}</div>
        {!preview && status && Object.values(status.providers).some(value=>!value) && <p className="text-sm text-zinc-400">{t('playlistImport.configHelp')}</p>}
        {!preview && status?.providers.SPOTIFY && <button type="button" disabled={busy||saving} className="ns-button-secondary min-h-11 px-4 text-sm" onClick={status.spotifyConnected?async()=>{try{await disconnectSpotifyImport();setStatus({...status,spotifyConnected:false});}catch(err){showError(err);}}:connect}>{t(status.spotifyConnected?'playlistImport.disconnectSpotify':'playlistImport.connectSpotify')}</button>}
        <form hidden={Boolean(preview)} onSubmit={start} className="space-y-3">
          <label className="block text-sm">{t('playlistImport.link')}<input value={url} disabled={busy||saving} onChange={event=>setUrl(event.target.value)} className="ns-field mt-2 w-full px-3" type="url" required maxLength={1000} placeholder="https://open.spotify.com/playlist/…" /></label>
          <button type="submit" disabled={busy||saving||!url.trim()} className="ns-button-secondary min-h-11 px-4">{t(busy?'playlistImport.loading':'playlistImport.preview')}</button>
          {busy && <p role="status" className="text-sm text-zinc-400">{t('playlistImport.loading')}</p>}
        </form>
        {error && <p role="alert" className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        {preview && <>
          <button type="button" disabled={saving} className="ns-button-secondary min-h-11 px-3 text-sm" onClick={()=>{controller.current?.abort();setPreview(null);setBusy(false);setError('');}}>{t('playlistImport.changeSource')}</button>
          <label className="block text-sm">{t('playlistImport.name')}<input value={name} onChange={event=>setName(event.target.value)} disabled={saving} maxLength={120} className="ns-field mt-2 w-full px-3"/></label>
          <p role="status" className="text-sm text-zinc-300">{t('playlistImport.loaded',{count:preview.entries.length,total:preview.total})}</p>
          {preview.truncated && <p role="alert" className="text-sm text-amber-300">{t('playlistImport.limited',{limit:status?.maxTracks||1000})}</p>}
          {preview.unavailable>0 && <p className="text-sm text-amber-300">{t('playlistImport.unavailableCount',{count:preview.unavailable})}</p>}
          <SourceTrackList tracks={preview.entries} />
          {!preview.entries.length && <p>{t('playlistImport.empty')}</p>}
        </>}
      </div>
      {preview && <footer className="shrink-0 space-y-2 border-t border-zinc-800 p-5"><p className="text-xs text-zinc-400">{t('playlistImport.privateHelp')}</p><button type="button" onClick={confirm} disabled={busy||saving||!preview.entries.length||!name.trim()||preview.truncated} className="ns-button-primary min-h-11 w-full px-4">{t(saving?'playlistImport.saving':'playlistImport.confirm',{count:preview.entries.length})}</button></footer>}
    </section>
  </div>,document.body);
}
