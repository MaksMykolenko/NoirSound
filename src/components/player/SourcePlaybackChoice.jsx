import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sourceAlternatives, saveSourceChoice } from '../../api/playlistImport';
import { usePlayerStore } from '../../store/playerStore';

export default function SourcePlaybackChoice({ embed }) {
  const { t } = useTranslation();
  const [candidates,setCandidates] = useState([]), [busy,setBusy] = useState(true), [saving,setSaving] = useState(false), [error,setError] = useState(''), [url,setUrl] = useState('');
  const controller=useRef(null);
  const showError=useCallback(err=>setError(t('playlistImport.errors.'+(err.code||'IMPORT_FAILED'),{defaultValue:t('playlistImport.errors.IMPORT_FAILED')})),[t]);
  const search=useCallback(async payload=>{
    controller.current?.abort();const abort=new AbortController();controller.current=abort;
    setBusy(true);setError('');
    try { const result=await sourceAlternatives(embed.playlistId,embed.position,payload,abort.signal);if(!abort.signal.aborted)setCandidates(result.candidates); }
    catch(err) { if(!abort.signal.aborted)showError(err); }
    finally { if(!abort.signal.aborted)setBusy(false); }
  },[embed.playlistId,embed.position,showError]);
  useEffect(()=>{search({});return()=>controller.current?.abort();},[search]); // A search starts only after the listener requests this track.
  const choose=async candidate=>{
    controller.current?.abort();const abort=new AbortController();controller.current=abort;
    setSaving(true);setError('');
    try {
      await saveSourceChoice(embed.playlistId,embed.position,candidate.selection,abort.signal);
      if(!abort.signal.aborted)await usePlayerStore.getState().playTrack(embed.track,embed.sourceQueue);
    } catch(err) { if(!abort.signal.aborted){showError(err);setSaving(false);} }
  };
  return <div className="space-y-3">
    <p className="text-sm text-[var(--ns-text-muted)]">{t('playlistImport.chooseVersionHelp')}</p>
    {busy && <p role="status" className="text-sm">{t('playlistImport.searchingVersions')}</p>}
    {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
    {!busy&&!error&&!candidates.length && <p className="text-sm">{t('playlistImport.noVersions')}</p>}
    <ul className="space-y-2">{candidates.map(candidate=><li key={candidate.videoId}>
      <button type="button" disabled={busy||saving} onClick={()=>choose(candidate)} className="w-full rounded-lg border border-[var(--ns-border)] p-3 text-left text-sm hover:bg-[var(--ns-surface-raised)] disabled:opacity-40">
        <span className="block font-medium">{candidate.title}</span><span className="block text-xs text-[var(--ns-text-muted)]">YouTube · {candidate.channel}{candidate.duration?` · ${Math.floor(candidate.duration/60)}:${String(candidate.duration%60).padStart(2,'0')}`:''}</span>
        <span className="mt-1 block text-xs text-brand-red">{t(saving?'playlistImport.saving':'playlistImport.chooseAndPlay')}</span>
      </button>
    </li>)}</ul>
    <form onSubmit={event=>{event.preventDefault();search({url:url.trim()});}} className="space-y-2 border-t border-[var(--ns-border)] pt-3">
      <label className="block text-xs">{t('playlistImport.videoLink')}<input type="url" required maxLength={1000} value={url} onChange={event=>setUrl(event.target.value)} className="ns-field mt-2 w-full px-3" placeholder="https://www.youtube.com/watch?v=…" disabled={busy||saving}/></label>
      <button type="submit" disabled={!url.trim()||busy||saving} className="ns-button-secondary min-h-11 px-3 text-sm">{t('playlistImport.checkVideo')}</button>
    </form>
  </div>;
}
