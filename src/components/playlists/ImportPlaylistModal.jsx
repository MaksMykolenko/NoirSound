import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';
import { importStatus, previewImport, matchImport, commitImport, connectSpotifyImport, disconnectSpotifyImport } from '../../api/playlistImport';

export default function ImportPlaylistModal({ onClose, onImported }) {
  const { t }=useTranslation();
  const [status,setStatus]=useState(null), [error,setError]=useState('');
  const [url,setUrl]=useState(()=>{try{return sessionStorage.getItem('noirsound.importUrl')||'';}catch{return '';}});
  const [fileText,setFileText]=useState(''), [fileName,setFileName]=useState('');
  const [preview,setPreview]=useState(null), [rows,setRows]=useState([]), [name,setName]=useState('');
  const [busy,setBusy]=useState(false), [saving,setSaving]=useState(false), [completed,setCompleted]=useState(0);
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
    event.preventDefault();setError('');setBusy(true);setPreview(null);setRows([]);setCompleted(0);
    controller.current?.abort();controller.current=new AbortController();const signal=controller.current.signal;
    requestId.current=crypto.randomUUID();
    try {
      const loaded=await previewImport(fileText?{fileText}:{url:url.trim()},signal);
      if(signal.aborted)return;
      setPreview(loaded);setName(loaded.provider==='FILE'?t('playlistImport.defaultName'):loaded.name);
      const next=loaded.entries.map(entry=>({entry,candidates:[],selected:'',pending:true}));
      setRows([...next]);
      for(let i=0;i<next.length;i+=5) {
        const {results}=await matchImport(next.slice(i,i+5).map(row=>row.entry),signal);
        if(signal.aborted)return;
        results.forEach((result,index)=>{next[i+index]={...next[i+index],...result,selected:result.selected||'',pending:false};});
        setRows([...next]);setCompleted(Math.min(i+5,next.length));
      }
      try{sessionStorage.removeItem('noirsound.importUrl');}catch{/* Optional resume. */}
    }catch(err){if(err.name!=='AbortError')showError(err);}
    finally{if(!signal.aborted)setBusy(false);}
  };
  const selected=rows.flatMap(row=>{const candidate=row.candidates.find(c=>c.key===row.selected);return candidate?[candidate.selection]:[];});
  const confirm=async()=>{
    setSaving(true);setError('');
    try {const result=await commitImport({name:name.trim(),selections:selected,requestId:requestId.current});onImported(result);}
    catch(err){showError(err);setSaving(false);}
  };
  return createPortal(<div className="fixed inset-0 z-[var(--ns-z-confirmation)] flex items-center justify-center bg-black/80 p-3 sm:p-5">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="playlist-import-title" className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 p-5">
        <div><h2 id="playlist-import-title" className="text-xl font-semibold">{t('playlistImport.title')}</h2><p className="mt-2 text-sm text-zinc-400">{t('playlistImport.help')}</p></div>
        <button type="button" disabled={saving} onClick={onClose} className="ns-icon-button shrink-0" aria-label={t('lyrics.close')}><X size={20}/></button>
      </header>
      <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5">
        <div hidden={Boolean(preview)} className="flex flex-wrap gap-2 text-xs">{['SPOTIFY','YOUTUBE','SOUNDCLOUD'].map(provider=><span key={provider} className="rounded border border-zinc-800 px-2 py-1">{provider==='YOUTUBE'?'YouTube':provider==='SOUNDCLOUD'?'SoundCloud':'Spotify'} · {status?t(status.providers[provider]?'playlistImport.available':'playlistImport.unconfigured'):t('lyrics.loading')}</span>)}</div>
        {!preview && status && Object.values(status.providers).some(value=>!value) && <p className="text-sm text-zinc-400">{t('playlistImport.configHelp')}</p>}
        {!preview && status?.providers.SPOTIFY && <button type="button" disabled={busy||saving} className="ns-button-secondary min-h-11 px-4 text-sm" onClick={status.spotifyConnected?async()=>{try{await disconnectSpotifyImport();setStatus({...status,spotifyConnected:false});}catch(err){showError(err);}}:connect}>{t(status.spotifyConnected?'playlistImport.disconnectSpotify':'playlistImport.connectSpotify')}</button>}
        <form hidden={Boolean(preview)} onSubmit={start} className="space-y-3">
          <label className="block text-sm">{t('playlistImport.link')}<input value={url} disabled={busy||saving} onChange={event=>{setUrl(event.target.value);setFileText('');setFileName('');}} className="ns-field mt-2 w-full px-3" type="url" maxLength={1000} placeholder="https://open.spotify.com/playlist/…" /></label>
          <label className="block text-sm">{t('playlistImport.file')}<input type="file" disabled={busy||saving} accept=".csv,.txt,text/csv,text/plain" className="mt-2 block max-w-full text-sm text-zinc-400" onChange={async event=>{
            const file=event.target.files?.[0];event.target.value='';if(!file)return;setError('');
            if(file.size>150000){setError(t('playlistImport.errors.IMPORT_FILE_INVALID'));return;}
            try{setFileText(await file.text());setFileName(file.name);setUrl('');}catch{setError(t('playlistImport.errors.IMPORT_FILE_INVALID'));}
          }}/></label>
          <p className="break-words text-xs text-zinc-400">{fileName || t('playlistImport.fileHelp')}</p>
          <button type="submit" disabled={busy||saving||(!url.trim()&&!fileText)} className="ns-button-secondary min-h-11 px-4">{t(busy?'playlistImport.matching':'playlistImport.preview')}</button>
          {busy && <p role="status" className="text-sm text-zinc-400">{preview?t('playlistImport.progress',{done:completed,total:rows.length}):t('lyrics.loading')}</p>}
        </form>
        {error && <p role="alert" className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        {preview && <>
          <button type="button" disabled={saving} className="ns-button-secondary min-h-11 px-3 text-sm" onClick={()=>{controller.current?.abort();setPreview(null);setRows([]);setBusy(false);setError('');}}>{t('playlistImport.changeSource')}</button>
          {busy && <p role="status" className="text-sm text-zinc-400">{t('playlistImport.progress',{done:completed,total:rows.length})}</p>}
          <label className="block text-sm">{t('playlistImport.name')}<input value={name} onChange={event=>setName(event.target.value)} disabled={saving} maxLength={120} className="ns-field mt-2 w-full px-3"/></label>
          <p className="text-sm text-zinc-400">{t('playlistImport.selection',{selected:selected.length,total:rows.length})}</p>
          {(preview.truncated||preview.skipped>0) && <p role="status" className="text-sm text-amber-300">{t('playlistImport.limited',{skipped:preview.skipped,total:preview.total,loaded:rows.length})}</p>}
          <ol className="divide-y divide-zinc-800">{rows.map((row,index)=><li key={index} className="space-y-2 py-4">
            <p className="break-words text-sm font-medium">{index+1}. {row.entry.artist} — {row.entry.title}</p>
            {row.pending ? <p className="text-xs text-zinc-500">{t('playlistImport.pending')}</p> : <>
              <label className="block"><span className="sr-only">{t('playlistImport.matchFor',{title:row.entry.title})}</span><select value={row.selected} disabled={saving} onChange={event=>setRows(current=>current.map((item,i)=>i===index?{...item,selected:event.target.value}:item))} className="ns-field min-h-11 w-full min-w-0 max-w-full px-2 text-sm">
                <option value="">{t(row.candidates.length?'playlistImport.skip':'playlistImport.notFound')}</option>
                {row.candidates.map(candidate=><option key={candidate.key} value={candidate.key}>{candidate.artistName} — {candidate.title} · {candidate.provider}</option>)}
              </select></label>
              {row.warning && <p className="text-xs text-amber-300">{t('playlistImport.partial')}</p>}
            </>}
          </li>)}</ol>
          {!rows.length && <p>{t('playlistImport.empty')}</p>}
        </>}
      </div>
      {preview && <footer className="shrink-0 space-y-2 border-t border-zinc-800 p-5"><p className="text-xs text-zinc-400">{t('playlistImport.privateHelp')}</p><button type="button" onClick={confirm} disabled={busy||saving||!selected.length||!name.trim()||rows.some(row=>row.pending)} className="ns-button-primary min-h-11 w-full px-4">{t(saving?'playlistImport.saving':'playlistImport.confirm',{count:selected.length})}</button></footer>}
    </section>
  </div>,document.body);
}
