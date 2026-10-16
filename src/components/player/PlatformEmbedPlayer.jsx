import TrackSourceIcon from '../tracks/TrackSourceIcon';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExternalLink, X, SkipBack, SkipForward } from 'lucide-react';
import { importedPlaybackStatus } from '../../api/playlistImport';
import { catalogRequest } from '../../api/externalCatalog';
import { useUserStore } from '../../store/userStore';
import { usePlayerStore, registerPlatformFrameStop } from '../../store/playerStore';
import SourcePlaybackChoice from './SourcePlaybackChoice';
import YouTubePlayback from './YouTubePlayback';

export default function PlatformEmbedPlayer({ embed }) {
  const { t } = useTranslation();
  const user = useUserStore(s => s.user);
  const close = usePlayerStore(s => s.closePlatformEmbed);
  const frame = useRef(null);
  const playTrack = usePlayerStore(s => s.playTrack);
  const chooseVersion = usePlayerStore(s => s.chooseSourceVersion);
  const matching = embed.playbackMode === 'SOURCE_MATCH';
  const managedYouTube = embed.provider === 'YOUTUBE' && Boolean(embed.videoId) && !matching;
  const imported = embed.accessScope === 'playlist-import';
  const status = useQuery({queryKey:imported?['imported-playlist-status',user?.id,embed.playlistId]:['external-status',user?.id],queryFn:({signal})=>imported?importedPlaybackStatus(embed.playlistId,signal):catalogRequest('/status',{signal}),retry:false,refetchInterval:15000,refetchIntervalInBackground:true});
  const allowed = user?.id === embed.ownerId && status.data?.enabled === true && !status.error;
  useLayoutEffect(() => {
    if(managedYouTube||matching)return;
    const element = frame.current;
    const stop = () => { if (element) element.src = 'about:blank'; };
    const unregister = registerPlatformFrameStop(stop);
    return () => { stop(); unregister(); };
  }, [embed.generation, allowed, managedYouTube, matching]);
  useEffect(() => { if (user?.id !== embed.ownerId || (!allowed && !status.isPending)) close(); }, [allowed,status.isPending,user?.role,user?.id,embed.ownerId,close]);
  if (!allowed) return null;
  const youtube = embed.provider === 'YOUTUBE';
  const queue = embed.sourceQueue?.filter(track=>track.playbackMode==='OFFICIAL_EMBED') || [];
  const index = queue.findIndex(track=>track.id===embed.track?.id);
  const previous = index>0?queue[index-1]:null;
  const next = index>=0?queue[index+1]:null;
  return <section aria-label={t('externalMusic.officialPlayer')} data-testid="platform-embed-player" className="fixed bottom-24 right-4 z-[var(--ns-z-modal)] w-[calc(100vw-2rem)] max-w-[480px] overflow-auto rounded-xl border border-[var(--ns-border)] bg-[var(--ns-card-solid)] p-3 shadow-2xl lg:bottom-6 lg:right-8" style={{maxHeight:'calc(100dvh - 8rem)'}}>
    <div className="mb-2 flex items-center justify-between gap-3"><h2 className="min-w-0 break-words font-semibold"><span className="flex items-center gap-2"><TrackSourceIcon provider={embed.provider} />{embed.track?.title || embed.provider}</span>{embed.track?.artistName && <span className="block text-xs font-normal text-[var(--ns-text-muted)]">{embed.track.artistName}</span>}</h2><button type="button" onClick={close} aria-label={t('externalMusic.closePlayer')} className="rounded p-2 hover:bg-[var(--ns-surface-raised)]"><X size={20}/></button></div>
    {matching ? <SourcePlaybackChoice embed={embed}/> : managedYouTube ? <YouTubePlayback videoId={embed.videoId} onEnded={()=>{if(next)playTrack(next,embed.sourceQueue);}}/> : <iframe key={embed.generation} ref={frame} title={`${embed.provider} ${t('externalMusic.officialPlayer')}`} src={embed.embedUrl} width="100%" height={youtube?270:embed.wholePlaylist?352:175} className="rounded border-0" style={youtube?{minHeight:200}:undefined} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    {imported && !embed.wholePlaylist && <div className="mt-2 flex items-center justify-between gap-2">
      <button type="button" className="ns-icon-button disabled:opacity-30" disabled={!previous} onClick={()=>playTrack(previous,embed.sourceQueue)} aria-label={t('playlistImport.previousTrack')}><SkipBack size={18}/></button>
      <span className="text-xs tabular-nums">{Number(embed.position)+1} / {embed.total}</span>
      <button type="button" className="ns-icon-button disabled:opacity-30" disabled={!next} onClick={()=>playTrack(next,embed.sourceQueue)} aria-label={t('playlistImport.nextTrack')}><SkipForward size={18}/></button>
    </div>}
    {embed.canChoose&&!matching&&<button type="button" onClick={chooseVersion} className="ns-button-secondary mt-3 min-h-11 px-3 text-sm">{t('playlistImport.changeVersion')}</button>}
    {!matching&&<p className="mt-2 text-xs text-[var(--ns-text-muted)]">{t(embed.provider==='SPOTIFY'?'playlistImport.spotifyPlaybackNote':embed.provider==='APPLE_MUSIC'?'externalMusic.applePlaybackNote':'externalMusic.embedPlaybackNote')}</p>}
    <p className="mt-1 text-xs text-[var(--ns-text-muted)]">{t('externalMusic.embedPrivacyNote')}</p>
    {!matching&&<a href={embed.canonicalUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm underline"><ExternalLink size={14}/>{t('externalMusic.openPlatform')}</a>}
  </section>;
}
