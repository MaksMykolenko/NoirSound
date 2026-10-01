import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Plus, ExternalLink, Heart } from 'lucide-react';
import { catalogRequest, catalogMutation } from '../api/externalCatalog';
import { useUserStore } from '../store/userStore';
import { usePlayerStore } from '../store/playerStore';
import { getMyPlaylists, addTrackToPlaylist } from '../api/playlists';
import FallbackCover from '../components/ui/FallbackCover';
const PROVIDERS=['AUDIUS','SPOTIFY','SOUNDCLOUD','APPLE_MUSIC','YOUTUBE'];
const VERSIONS=['UNKNOWN','ORIGINAL','REMIX','LIVE','ACOUSTIC','INSTRUMENTAL','RADIO_EDIT','CLEAN','EXPLICIT','NIGHTCORE','SPED_UP','SLOWED','OTHER'];
const field='w-full rounded border border-[var(--ns-border-subtle)] bg-[var(--ns-surface)] p-2 text-sm';
const button='inline-flex items-center justify-center gap-2 rounded border border-[var(--ns-border-subtle)] px-3 py-2 text-sm hover:bg-[var(--ns-surface-raised)] disabled:opacity-40';
const EMBED_PROVIDERS=['SOUNDCLOUD','APPLE_MUSIC','YOUTUBE'];
function PlatformPlayerForm() {
  const {t}=useTranslation();const [provider,setProvider]=useState('YOUTUBE'),[url,setUrl]=useState('');
  const open=usePlayerStore(s=>s.openPlatformEmbed);
  const request=useMutation({mutationFn:()=>open(provider,url.trim())});
  return <section className="space-y-3 rounded border border-[var(--ns-border-subtle)] p-4" aria-label={t('externalMusic.listenByLink')}>
    <h2 className="font-semibold">{t('externalMusic.listenByLink')}</h2><p className="text-sm text-[var(--ns-text-muted)]">{t('externalMusic.platformsNote')}</p>
    <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();request.mutate();}}>
      <select aria-label={t('externalMusic.playerProvider')} className={`${field} sm:max-w-44`} value={provider} onChange={e=>setProvider(e.target.value)}>{EMBED_PROVIDERS.map(p=><option key={p}>{p}</option>)}</select>
      <input aria-label={t('externalMusic.playerUrl')} className={`${field} min-w-0 sm:flex-1`} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…" type="url" maxLength={1000} required/>
      <button className={button} disabled={request.isPending}>{t('externalMusic.openPlayer')}</button>
    </form>{request.error&&request.error.name!=='AbortError'&&<p role="alert" className="text-sm text-rose-400">{t('externalMusic.error')} · {request.error.code || request.error.message}</p>}
  </section>;
}
function PlatformSourceButton({source}) {
  const {t}=useTranslation();const open=usePlayerStore(s=>s.openPlatformEmbed);
  const request=useMutation({mutationFn:()=>open(source.provider,source.canonicalUrl)});
  return <><button className={button} disabled={request.isPending||source.matchStatus==='REJECTED'||source.officialStatus==='REJECTED'} onClick={()=>request.mutate()}>{t('externalMusic.openPlayer')}</button>{request.error&&request.error.name!=='AbortError'&&<span role="alert" className="text-sm text-rose-400">{t('externalMusic.error')} · {request.error.code || request.error.message}</span>}</>;
}
function MusicCard({track,onImport,busy}) {
  const {t}=useTranslation();const playTrack=usePlayerStore(s=>s.playTrack),pause=usePlayerStore(s=>s.pause),current=usePlayerStore(s=>s.currentTrack),playing=usePlayerStore(s=>s.isPlaying),loading=usePlayerStore(s=>s.playbackLoading);
  const active=current?.id===track.id;
  return <article className="flex min-w-0 gap-3 rounded border border-[var(--ns-border-subtle)] bg-[var(--ns-surface)] p-3" data-testid="external-result">
    <FallbackCover src={track.coverUrl} title={track.title} artistName={track.artistName} className="h-16 w-16 shrink-0 rounded" />
    <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{track.recordingId?<Link to={`/external-music/${track.recordingId}`}>{track.title}</Link>:track.title}</h2><p className="truncate text-sm text-[var(--ns-text-muted)]">{track.artistName} · {track.provider || 'Audius'}</p><p className="text-xs text-[var(--ns-text-muted)]">{t(`externalMusic.versions.${track.versionType || 'UNKNOWN'}`)} · {t('externalMusic.unverified')}</p>
      <div className="mt-2 flex flex-wrap gap-2"><button className={button} disabled={!track.isStreamable || busy || (active&&loading)} onClick={()=>active&&playing?pause():playTrack(track,[track],'external-catalog')} aria-label={t(active&&playing?'externalMusic.pause':'externalMusic.play')}>{active&&playing?<Pause size={16}/>:<Play size={16}/>} {active&&loading?t('externalMusic.loading'):t(active&&playing?'externalMusic.pause':track.isStreamable?'externalMusic.play':'externalMusic.unavailable')}</button>
      {!track.recordingId&&<button className={button} onClick={()=>onImport(track)} disabled={busy || !track.isStreamable}><Plus size={16}/>{t('externalMusic.add')}</button>}
      {track.canonicalUrl&&<a className={button} href={track.canonicalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Audius</a>}</div>
      {track.otherVersions?.length>0&&<details className="mt-2"><summary className="cursor-pointer text-sm">{t('externalMusic.otherVersions')}</summary>{track.otherVersions.map(v=><Link key={v.recordingId} className="block py-1 text-sm underline" to={`/external-music/${v.recordingId}`}>{v.title}</Link>)}</details>}
    </div>
  </article>;
}
function SourceEditor({source,run,pending}) {
  const {t}=useTranslation();const [url,setUrl]=useState(source.canonicalUrl),[match,setMatch]=useState(source.matchStatus),[official,setOfficial]=useState(source.officialStatus),[primary,setPrimary]=useState(source.isPrimary),[evidence,setEvidence]=useState(''),[reason,setReason]=useState('');
  return <details className="mt-2"><summary className="cursor-pointer text-sm">{t('externalMusic.editSource')}</summary><form className="mt-2 grid gap-2 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();run(`/sources/${source.id}`,{...(url!==source.canonicalUrl?{url}:{}),matchStatus:match,officialStatus:official,isPrimary:primary,...(evidence?{evidence}:{}),reason},'PATCH');}}>
    <label className="sm:col-span-2">URL<input aria-label="Source URL" className={field} value={url} onChange={e=>setUrl(e.target.value)} disabled={source.provider==='AUDIUS'} type="url" required/></label>
    <label>{t('externalMusic.match')}<select className={field} value={match} onChange={e=>setMatch(e.target.value)}>{['UNVERIFIED','CONFIRMED','REJECTED'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{t('externalMusic.official')}<select className={field} value={official} onChange={e=>setOfficial(e.target.value)}>{['UNVERIFIED','VERIFIED','REJECTED'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label className="sm:col-span-2">{t('externalMusic.evidence')}<input className={field} value={evidence} onChange={e=>setEvidence(e.target.value)} minLength={3} maxLength={1000} required={match==='CONFIRMED'||official==='VERIFIED'}/></label>
    <label className="sm:col-span-2">{t('externalMusic.reason')}<input className={field} value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={1000} required/></label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={primary} onChange={e=>setPrimary(e.target.checked)}/>{t('externalMusic.primary')}</label><button className={button} disabled={pending}>{t('externalMusic.save')}</button>
  </form></details>;
}
function RecordingDetail({recording,versions,audit,records,run,pending}) {
  const {t}=useTranslation();const play=usePlayerStore(s=>s.playTrack),likes=usePlayerStore(s=>s.likedTracks),toggleLike=usePlayerStore(s=>s.toggleLikeTrack);
  const [reason,setReason]=useState(''),[provider,setProvider]=useState('SPOTIFY'),[url,setUrl]=useState(''),[intoId,setIntoId]=useState(''),[evidence,setEvidence]=useState(''),[versionType,setVersion]=useState(recording.versionType),[parentId,setParent]=useState(recording.parentId || ''),[label,setLabel]=useState(recording.versionLabel || ''),[playlistId,setPlaylist]=useState('');
  const playlists=useQuery({queryKey:['external-private-playlists'],queryFn:getMyPlaylists});
  return <div className="space-y-5">
    <Link className="text-sm underline" to="/external-music">{t('externalMusic.back')}</Link>
    <MusicCard track={recording} busy={pending}/>
    <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>toggleLike(recording.id)} disabled={!recording.isStreamable}><Heart size={16} fill={likes.includes(recording.id)?'currentColor':'none'}/>{t('externalMusic.like')}</button>
      <select aria-label={t('externalMusic.playlist')} className={`${field} max-w-xs`} value={playlistId} onChange={e=>setPlaylist(e.target.value)}><option value="">{t('externalMusic.playlist')}</option>{playlists.data?.filter(p=>!p.isPublic).map(p=><option key={p.id} value={p.id}>{p.name || p.title}</option>)}</select><button className={button} disabled={!playlistId||!recording.isStreamable||pending} onClick={()=>run(null,{playlistId,trackId:recording.id})}>{t('externalMusic.add')}</button>
    </div>
    <p className="text-sm text-[var(--ns-text-muted)]">{t('externalMusic.linkOutNote')}</p>
    <section className="space-y-3" aria-label={t('externalMusic.sources')}><h2 className="font-semibold">{t('externalMusic.sources')}</h2>{recording.sources.map(s=><div key={s.id} className="rounded border border-[var(--ns-border-subtle)] p-3">
      <div className="flex flex-wrap items-center gap-3"><a className={button} href={s.canonicalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>{s.provider} · {s.playbackMode}</a><span className="text-xs">{s.matchStatus} · {s.officialStatus==='VERIFIED'?t('externalMusic.verified'):t('externalMusic.unverified')} · {s.availability}</span>{recording.primarySources.some(p=>p.id===s.id)&&<span className="text-xs">{t('externalMusic.primary')}</span>}
      {EMBED_PROVIDERS.includes(s.provider)&&<PlatformSourceButton source={s}/>}
      {s.playbackMode==='EXTERNAL_STREAM'&&<button className={button} disabled={s.availability!=='AVAILABLE'||s.matchStatus!=='CONFIRMED'} onClick={()=>play({...recording,playbackSource:'external',playbackMode:'EXTERNAL_STREAM',provider:s.provider,selectedSourceId:s.id,isStreamable:true},null,'external-catalog')}>{t('externalMusic.play')}</button>}</div>
      <SourceEditor source={s} run={run} pending={pending}/>
    </div>)}</section>
    <details><summary className="cursor-pointer font-semibold">{t('externalMusic.addSource')}</summary><form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();run(`/recordings/${recording.recordingId}/sources`,{provider,url,reason});}}>
      <select aria-label={t('externalMusic.provider')} className={field} value={provider} onChange={e=>setProvider(e.target.value)}>{PROVIDERS.map(p=><option key={p}>{p}</option>)}</select><input aria-label="Platform URL" className={field} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…" type="url" required/>
      <label className="sm:col-span-2">{t('externalMusic.reason')}<input className={field} value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={1000} required/></label><button className={button} disabled={pending}>{t('externalMusic.add')}</button>
    </form></details>
    <details><summary className="cursor-pointer font-semibold">{t('externalMusic.version')}</summary><form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();run(`/recordings/${recording.recordingId}`,{versionType,versionLabel:label,parentId:parentId || null,reason},'PATCH');}}>
      <select aria-label={t('externalMusic.version')} className={field} value={versionType} onChange={e=>setVersion(e.target.value)}>{VERSIONS.map(v=><option key={v} value={v}>{t(`externalMusic.versions.${v}`)}</option>)}</select><input aria-label={t('externalMusic.versionLabel')} className={field} value={label} onChange={e=>setLabel(e.target.value)} placeholder={t('externalMusic.versionLabel')} maxLength={200}/>
      <select aria-label={t('externalMusic.parent')} className={field} value={parentId} onChange={e=>setParent(e.target.value)}><option value="">{t('externalMusic.parent')}</option>{records.filter(r=>r.recordingId!==recording.recordingId).map(r=><option key={r.recordingId} value={r.recordingId}>{r.title}</option>)}</select><input aria-label={t('externalMusic.reason')} className={field} value={reason} onChange={e=>setReason(e.target.value)} placeholder={t('externalMusic.reason')} minLength={3} required/><button className={button} disabled={pending}>{t('externalMusic.save')}</button>
    </form></details>
    <details><summary className="cursor-pointer font-semibold">{t('externalMusic.merge')}</summary><p className="mt-2 text-sm text-[var(--ns-text-muted)]">{t('externalMusic.mergeNote')}</p><form className="mt-3 grid gap-2" onSubmit={e=>{e.preventDefault();run(`/recordings/${recording.recordingId}/merge`,{intoId,evidence,reason});}}>
      <select aria-label={t('externalMusic.mergeTarget')} className={field} value={intoId} onChange={e=>setIntoId(e.target.value)} required><option value="">{t('externalMusic.mergeTarget')}</option>{records.filter(r=>r.recordingId!==recording.recordingId).map(r=><option key={r.recordingId} value={r.recordingId}>{r.title} · {r.artistName}</option>)}</select>
      <input aria-label={t('externalMusic.evidence')} className={field} value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder={t('externalMusic.evidence')} minLength={3} required/><input aria-label={t('externalMusic.reason')} className={field} value={reason} onChange={e=>setReason(e.target.value)} placeholder={t('externalMusic.reason')} minLength={3} required/><button className={button} disabled={pending}>{t('externalMusic.merge')}</button>
    </form>{recording.members.map(m=><form key={m.id} className="mt-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();run(`/recordings/${m.id}/unmerge`,{reason});}}><input aria-label={t('externalMusic.reason')} className={`${field} max-w-sm`} value={reason} onChange={e=>setReason(e.target.value)} placeholder={t('externalMusic.reason')} minLength={3} required/><button className={button} disabled={pending}>{t('externalMusic.unmerge')} · {m.trackId.slice(0,8)}</button></form>)}</details>
    {versions.length>0&&<section><h2 className="font-semibold">{t('externalMusic.otherVersions')}</h2>{versions.map(v=><Link key={v.recordingId} className="block py-2 underline" to={`/external-music/${v.recordingId}`}>{v.title}</Link>)}</section>}
    <details><summary className="cursor-pointer font-semibold">{t('externalMusic.audit')}</summary>{audit.map(a=><p key={a.id} className="py-2 text-xs">{new Date(a.createdAt).toLocaleString()} · {a.action} · {a.reason}</p>)}</details>
  </div>;
}
function NewRecording({run,pending}) {
  const {t}=useTranslation();const [title,setTitle]=useState(''),[artistName,setArtist]=useState(''),[provenance,setProvenance]=useState(''),[nativeTrackId,setNative]=useState(''),[reason,setReason]=useState('');
  return <details><summary className="cursor-pointer font-semibold">{t('externalMusic.createRecord')}</summary><form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();run('/recordings',nativeTrackId?{nativeTrackId,reason}:{title,artistName,provenance,reason});}}>
    <input className={field} aria-label={t('externalMusic.trackTitle')} placeholder={t('externalMusic.trackTitle')} value={title} onChange={e=>setTitle(e.target.value)} required={!nativeTrackId}/><input className={field} aria-label={t('externalMusic.artist')} placeholder={t('externalMusic.artist')} value={artistName} onChange={e=>setArtist(e.target.value)} required={!nativeTrackId}/>
    <input className={field} aria-label={t('externalMusic.provenance')} placeholder={t('externalMusic.provenance')} value={provenance} onChange={e=>setProvenance(e.target.value)} minLength={3} required={!nativeTrackId}/><input className={field} aria-label={t('externalMusic.nativeId')} placeholder={t('externalMusic.nativeId')} value={nativeTrackId} onChange={e=>setNative(e.target.value)}/>
    <input className={field} aria-label={t('externalMusic.reason')} placeholder={t('externalMusic.reason')} value={reason} onChange={e=>setReason(e.target.value)} minLength={3} required/><button className={button} disabled={pending}>{t('externalMusic.add')}</button>
  </form></details>;
}
export default function ExternalMusic() {
  const {id}=useParams();const {t}=useTranslation();const user=useUserStore(s=>s.user),hydrated=useUserStore(s=>s.authHydrated),setAuth=useUserStore(s=>s.setAuthModalOpen);const client=useQueryClient();
  const [input,setInput]=useState(''),[q,setQuery]=useState(''),[offset,setOffset]=useState(0),[notice,setNotice]=useState('');const admin=hydrated&&user?.role==='ADMIN';
  const status=useQuery({queryKey:['external-status',user?.id],queryFn:()=>catalogRequest('/status'),enabled:admin,retry:false});
  const enabled=admin&&status.data?.enabled===true;
  const records=useQuery({queryKey:['external-recordings',user?.id],queryFn:({signal})=>catalogRequest('/recordings',{signal}),enabled,retry:false});
  const search=useQuery({queryKey:['external-search',user?.id,q,offset],queryFn:({signal})=>catalogRequest('/search?'+new URLSearchParams({q,offset:String(offset),limit:'20'}),{signal}),enabled:enabled&&Boolean(q),retry:false,staleTime:0,gcTime:60000});
  const detail=useQuery({queryKey:['external-recording',user?.id,id],queryFn:({signal})=>catalogRequest(`/recordings/${encodeURIComponent(id)}`,{signal}),enabled:enabled&&Boolean(id),retry:false});
  const mutation=useMutation({mutationFn:({path,body,method})=>path===null?addTrackToPlaylist(body.playlistId,body.trackId):catalogMutation(path,body,method),onSuccess:(result)=>{if(result?.enabled===false)usePlayerStore.getState().closePlatformEmbed();setNotice(t('externalMusic.saved'));client.invalidateQueries({queryKey:['external-recordings']});client.invalidateQueries({queryKey:['external-recording']});client.invalidateQueries({queryKey:['external-search']});client.invalidateQueries({queryKey:['external-status']});},onError:()=>setNotice('')});
  const run=(path,body,method='POST')=>{setNotice('');mutation.mutate({path,body,method});};
  const error=mutation.error || detail.error || search.error || records.error || status.error;
  if(!hydrated)return <p role="status">{t('externalMusic.loading')}</p>;
  if(!admin)return <div className="space-y-4"><h1 className="ns-page-title">{t('externalMusic.title')}</h1><p>{t('externalMusic.private')}</p>{!user&&<button className={button} onClick={()=>setAuth(true,'login')}>{t('externalMusic.signIn')}</button>}</div>;
  return <div className="space-y-6 pb-8" data-testid="external-music-page">
    <h1 className="ns-page-title">{t('externalMusic.title')}</h1><p className="text-sm text-[var(--ns-text-muted)]">{t('externalMusic.betaNote')}</p>
    <div className="flex flex-wrap gap-2">{status.data?.providers.map(p=><span key={p.provider} className="rounded border border-[var(--ns-border-subtle)] px-2 py-1 text-xs">{p.provider}: {enabled?p.status:'DISABLED'}</span>)}</div>
    {error&&<p role="alert" className="rounded border border-rose-800 p-3 text-sm">{t('externalMusic.error')} · {error.code || error.message}<button className={`${button} ml-2`} onClick={()=>{status.refetch();if(enabled){records.refetch();if(q)search.refetch();if(id)detail.refetch();}}}>{t('externalMusic.retry')}</button></p>}
    {notice&&<p role="status">{notice}</p>}
    {status.isPending&&<p role="status">{t('externalMusic.loading')}</p>}
    {status.data&&!enabled&&<p role="status">{t('externalMusic.disabled')}</p>}
    {enabled&&id&&<>{detail.isPending?<p role="status">{t('externalMusic.loading')}</p>:detail.data&&<RecordingDetail key={detail.data.recording.recordingId} {...detail.data} records={records.data?.items || []} run={run} pending={mutation.isPending}/>}</>}
    {enabled&&!id&&<>
      <PlatformPlayerForm/>
      <form role="search" className="flex gap-2" onSubmit={e=>{e.preventDefault();setQuery(input.trim());setOffset(0);}}><input aria-label={t('externalMusic.search')} className={field} placeholder={t('externalMusic.searchPlaceholder')} value={input} onChange={e=>setInput(e.target.value)} maxLength={200} required/><button className={button}>{t('externalMusic.search')}</button></form>
      {q&&<section className="space-y-3" aria-label={t('externalMusic.results')}><h2 className="font-semibold">{t('externalMusic.results')}</h2>{search.isFetching&&<p role="status">{t('externalMusic.loading')}</p>}{search.data?.items.length===0&&<p>{t('externalMusic.empty')}</p>}<div className="grid gap-3 xl:grid-cols-2">{search.data?.items.map(track=><MusicCard key={track.id} track={track} busy={mutation.isPending} onImport={t=>run('/import',{externalId:t.externalId})}/>)}</div><div className="flex gap-2"><button className={button} disabled={offset===0||search.isFetching} onClick={()=>setOffset(Math.max(0,offset-20))}>{t('externalMusic.previous')}</button><button className={button} disabled={!search.data?.pageInfo.hasNextPage||search.isFetching} onClick={()=>setOffset(offset+20)}>{t('externalMusic.next')}</button></div></section>}
      <section className="space-y-3"><h2 className="font-semibold">{t('externalMusic.catalog')}</h2>{records.isPending&&<p role="status">{t('externalMusic.loading')}</p>}{records.data?.items.length===0&&<p>{t('externalMusic.emptyCatalog')}</p>}<div className="grid gap-3 xl:grid-cols-2">{records.data?.items.map(track=><MusicCard key={track.id} track={track} busy={mutation.isPending}/>)}</div></section><NewRecording run={run} pending={mutation.isPending}/>
    </>}
    {status.data&&<form className="flex flex-wrap gap-2 border-t border-[var(--ns-border-subtle)] pt-4" onSubmit={e=>{e.preventDefault();const reason=new FormData(e.currentTarget).get('reason');run('/settings',{enabled:!status.data.enabled,reason},'PATCH');}}><input name="reason" aria-label={t('externalMusic.reason')} className={`${field} max-w-sm`} placeholder={t('externalMusic.reason')} minLength={3} maxLength={1000} required/><button className={button} disabled={mutation.isPending}>{t(status.data.enabled?'externalMusic.disable':'externalMusic.enable')}</button></form>}
  </div>;
}
