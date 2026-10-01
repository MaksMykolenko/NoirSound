import TrackSourceIcon from '../tracks/TrackSourceIcon';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExternalLink, X } from 'lucide-react';
import { catalogRequest } from '../../api/externalCatalog';
import { useUserStore } from '../../store/userStore';
import { usePlayerStore, registerPlatformFrameStop } from '../../store/playerStore';

export default function PlatformEmbedPlayer({ embed }) {
  const { t } = useTranslation();
  const user = useUserStore(s => s.user);
  const close = usePlayerStore(s => s.closePlatformEmbed);
  const frame = useRef(null);
  const status = useQuery({queryKey:['external-status',user?.id],queryFn:({signal})=>catalogRequest('/status',{signal}),enabled:user?.role==='ADMIN',retry:false,refetchInterval:15000,refetchIntervalInBackground:true});
  const allowed = user?.role === 'ADMIN' && user.id === embed.ownerId && status.data?.enabled === true && !status.error;
  useLayoutEffect(() => {
    const element = frame.current;
    const stop = () => { if (element) element.src = 'about:blank'; };
    const unregister = registerPlatformFrameStop(stop);
    return () => { stop(); unregister(); };
  }, [embed.generation, allowed]);
  useEffect(() => { if (user?.role !== 'ADMIN' || user?.id !== embed.ownerId || (!allowed && !status.isPending)) close(); }, [allowed,status.isPending,user?.role,user?.id,embed.ownerId,close]);
  if (!allowed) return null;
  const youtube = embed.provider === 'YOUTUBE';
  return <section aria-label={t('externalMusic.officialPlayer')} data-testid="platform-embed-player" className="fixed bottom-24 right-4 z-[var(--ns-z-modal)] w-[calc(100vw-2rem)] max-w-[480px] overflow-auto rounded-xl border border-[var(--ns-border)] bg-[var(--ns-card-solid)] p-3 shadow-2xl lg:bottom-6 lg:right-8" style={{maxHeight:'calc(100dvh - 8rem)'}}>
    <div className="mb-2 flex items-center justify-between gap-3"><h2 className="font-semibold"><span className="flex items-center gap-2"><TrackSourceIcon provider={embed.provider} />{embed.track?.title || embed.provider}</span>{embed.track?.artistName && <span className="block text-xs font-normal text-[var(--ns-text-muted)]">{embed.track.artistName}</span>}</h2><button type="button" onClick={close} aria-label={t('externalMusic.closePlayer')} className="rounded p-2 hover:bg-[var(--ns-surface-raised)]"><X size={20}/></button></div>
    <iframe key={embed.generation} ref={frame} title={`${embed.provider} ${t('externalMusic.officialPlayer')}`} src={embed.embedUrl} width="100%" height={youtube?270:175} className="rounded border-0" style={youtube?{minHeight:200}:undefined} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    <p className="mt-2 text-xs text-[var(--ns-text-muted)]">{t(embed.provider==='APPLE_MUSIC'?'externalMusic.applePlaybackNote':'externalMusic.embedPlaybackNote')}</p>
    <p className="mt-1 text-xs text-[var(--ns-text-muted)]">{t('externalMusic.embedPrivacyNote')}</p>
    <a href={embed.canonicalUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm underline"><ExternalLink size={14}/>{t('externalMusic.openPlatform')}</a>
  </section>;
}
