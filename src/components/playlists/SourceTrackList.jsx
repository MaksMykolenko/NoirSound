import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ExternalLink, Play } from 'lucide-react';

const PAGE_SIZE = 50;

export default function SourceTrackList({ tracks, onPlay, currentId }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(tracks.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const offset = currentPage * PAGE_SIZE;
  const pagination = <nav aria-label={t('playlistImport.pages')} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
    <button type="button" className="ns-button-secondary min-h-11 px-3" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)} aria-label={t('playlistImport.previousPage')}><ChevronLeft size={18}/></button>
    <label className="flex items-center gap-2">{t('playlistImport.page')}<select aria-label={t('playlistImport.page')} value={currentPage} onChange={event=>setPage(Number(event.target.value))} className="ns-field min-h-11 px-2">{Array.from({length:pages},(_,index)=><option key={index} value={index}>{index+1} / {pages}</option>)}</select></label>
    <span aria-live="polite">{t('playlistImport.range',{from:tracks.length?offset+1:0,to:Math.min(offset+PAGE_SIZE,tracks.length),total:tracks.length})}</span>
    <button type="button" className="ns-button-secondary min-h-11 px-3" disabled={currentPage>=pages-1} onClick={()=>setPage(currentPage+1)} aria-label={t('playlistImport.nextPage')}><ChevronRight size={18}/></button>
  </nav>;
  return <div>
    {pagination}
    <ol start={offset+1} className="divide-y divide-zinc-800" aria-label={t('playlists.tracks')}>
      {tracks.slice(offset,offset+PAGE_SIZE).map((track,index)=><li key={track.id||offset+index} className={`flex min-h-16 items-center gap-3 py-3 ${currentId===track.id?'text-brand-red':''}`}>
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-zinc-500">{offset+index+1}</span>
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{track.title}</p><p className="break-words text-xs text-zinc-400">{track.artistName||track.artist}</p>{track.unavailable&&<p className="mt-1 text-xs text-amber-300">{t('playlistImport.trackUnavailable')}</p>}</div>
        {onPlay && <button type="button" disabled={track.unavailable||track.playbackMode!=='OFFICIAL_EMBED'} onClick={()=>onPlay(track)} className="ns-icon-button shrink-0 disabled:opacity-30" aria-label={t('playlistImport.playTrack',{title:track.title})}><Play size={18}/></button>}
        {track.canonicalUrl && <a href={track.canonicalUrl} target="_blank" rel="noopener noreferrer" className="ns-icon-button shrink-0" aria-label={t('playlistImport.openTrack',{title:track.title})}><ExternalLink size={16}/></a>}
      </li>)}
    </ol>
    {pages>1&&pagination}
  </div>;
}
