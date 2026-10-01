import React,{useEffect,useMemo} from 'react';
import {useInfiniteQuery,useQuery,useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useUserStore} from '../../store/userStore';
import {catalogRequest} from '../../api/externalCatalog';
import TrackCard from './TrackCard';

export default function ExternalCatalogFeed(props) {
  const user=useUserStore(s=>s.user),hydrated=useUserStore(s=>s.authHydrated);
  if(!hydrated)return null;
  return <AuthorizedFeed key={user?.id || 'guest'} {...props} userId={user?.id || 'guest'}/>;
}
function AuthorizedFeed({query='',excludeIds=[],userId}) {
  const {t}=useTranslation(),client=useQueryClient();
  const status=useQuery({queryKey:['external-status',userId],queryFn:()=>catalogRequest('/status'),retry:false,staleTime:30000});
  const enabled=status.data?.enabled===true;
  const feed=useInfiniteQuery({queryKey:['external-feed',userId,query],initialPageParam:'',queryFn:({pageParam,signal})=>catalogRequest('/browse?'+new URLSearchParams({q:query,cursor:pageParam,limit:'20'}),{signal}),getNextPageParam:page=>page.pageInfo.nextCursor || undefined,enabled,retry:false,staleTime:30000,gcTime:60000});
  useEffect(()=>{
    const changed=()=>{
      client.invalidateQueries({queryKey:['external-feed']});
      client.invalidateQueries({queryKey:['external-recordings']});
      client.invalidateQueries({queryKey:['tracks','catalog']});
      client.invalidateQueries({queryKey:['tracks','catalog-selection']});
    };
    window.addEventListener('noirsound:external-catalog-changed',changed);
    return ()=>window.removeEventListener('noirsound:external-catalog-changed',changed);
  },[client]);
  const tracks=useMemo(()=>{
    const seen=new Set(excludeIds);
    return (feed.data?.pages.flatMap(p=>p.items) || []).filter(track=>{if(seen.has(track.id))return false;seen.add(track.id);return true;});
  },[feed.data,excludeIds]);
  if(!enabled)return null;
  const failures=feed.data?.pages[0]?.providers.filter(p=>p.status==='ERROR') || [];
  return <section className="space-y-4 pt-5" data-testid="external-catalog-feed" aria-label={t('externalMusic.feedTitle')}>
    <h2 className="ns-section-title">{t('externalMusic.feedTitle')}</h2>
    {feed.isPending&&<p role="status">{t('externalMusic.loading')}</p>}
    {feed.error&&<p role="alert">{t('externalMusic.error')} <button className="underline" onClick={()=>feed.refetch()}>{t('externalMusic.retry')}</button></p>}
    {failures.length>0&&<p role="status" className="text-sm text-[var(--ns-text-muted)]">{t('externalMusic.providerUnavailable',{providers:failures.map(p=>p.provider).join(', ')})} <button className="underline" onClick={()=>feed.refetch()}>{t('externalMusic.retry')}</button></p>}
    {!feed.isPending&&!feed.error&&tracks.length===0&&<p>{t('externalMusic.empty')}</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{tracks.map(track=><TrackCard key={track.id} track={track} tracksContext={tracks} queueSource="external-catalog"/>)}</div>
    {feed.hasNextPage&&<button className="ns-button-secondary px-4 py-2" disabled={feed.isFetchingNextPage} onClick={()=>feed.fetchNextPage()}>{t(feed.isFetchingNextPage?'discover.loadingMore':'discover.showMore')}</button>}
  </section>;
}
