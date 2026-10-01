'use strict';
const {CatalogError,platformUrl,versionFromTitle}=require('../lib/externalCatalog');
const {createHash}=require('node:crypto');
const SEARCH_PROVIDERS=['AUDIUS','APPLE_MUSIC','YOUTUBE'];
// No Spotify/SoundCloud API catalog is requested by this mixed-service product.
// Their published policies require separate permissions for this use case.
function createCatalogAdapters({fetchImpl=globalThis.fetch,env=process.env}={}) {
  async function json(url,provider,headers={}) {
    for(let attempt=0;attempt<2;attempt++) {
      let res;
      try {res=await fetchImpl(url,{headers,redirect:'manual',signal:AbortSignal.timeout(8000)});}catch {if(!attempt)continue;throw new CatalogError(`${provider}_UNAVAILABLE`,502);}
      if(res.status>=500&&!attempt){await res.body?.cancel();continue;}
      if(!res.ok){await res.body?.cancel();throw new CatalogError(`${provider}_HTTP_${res.status}`,res.status===404?404:res.status===429?429:502);}
      const reader=res.body.getReader(),chunks=[];let size=0;
      try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw new CatalogError(`${provider}_RESPONSE_TOO_LARGE`,502);chunks.push(value);}}finally {await reader.cancel();}
      try {return JSON.parse(Buffer.concat(chunks).toString());}catch {throw new CatalogError(`${provider}_RESPONSE_INVALID`,502);}
    }
  }
  const common=(provider,id,title,artistName,url,durationSeconds)=>({provider,externalId:id,title:String(title).slice(0,300),artistName:String(artistName).slice(0,200),canonicalUrl:platformUrl(provider,url).canonicalUrl,durationSeconds,versionType:versionFromTitle(title),officialStatus:'UNVERIFIED',matchStatus:'UNVERIFIED',availability:'AVAILABLE',playbackMode:'OFFICIAL_EMBED',provenance:`${provider}_PUBLIC_API`,checkedAt:new Date(),explicit:false,isrc:null,coverUrl:null});
  const storefront=/^[a-z]{2}$/.test(env.APPLE_MUSIC_STOREFRONT || '')?env.APPLE_MUSIC_STOREFRONT:'us';
  const appleStatus=()=>env.APPLE_MUSIC_DEVELOPER_TOKEN?'CONFIGURED':'NOT_CONFIGURED';
  async function appleRequest(path,params={}) {
    if(appleStatus()!=='CONFIGURED')throw new CatalogError('APPLE_MUSIC_NOT_CONFIGURED',503);
    return json(new URL(`/v1/catalog/${storefront}/${path}?`+new URLSearchParams(params),'https://api.music.apple.com'),'APPLE_MUSIC',{Authorization:`Bearer ${env.APPLE_MUSIC_DEVELOPER_TOKEN}`});
  }
  function appleTrack(t) {
    const a=t?.attributes;
    if(t?.type!=='songs'||!/^\d{1,32}$/.test(t.id)||!a?.name||!a.artistName||!a.url)throw new CatalogError('APPLE_MUSIC_RESPONSE_INVALID',502);
    const link=new URL(a.url);
    if(link.protocol!=='https:'||link.hostname!=='music.apple.com'||link.username||link.password||link.port||(link.searchParams.get('i')||link.pathname.split('/').at(-1))!==t.id)throw new CatalogError('APPLE_MUSIC_RESPONSE_INVALID',502);
    const m=common('APPLE_MUSIC',t.id,a.name,a.artistName,`https://music.apple.com/${storefront}/song/${t.id}`,Math.max(0,Math.min(36000,Math.round(Number(a.durationInMillis || 0)/1000))));
    m.explicit=a.contentRating==='explicit';m.isrc=/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(a.isrc||'')?a.isrc:null;
    // Keep artwork as a remote image; never copy audio/preview URLs or payloads.
    try {const u=new URL(a.artwork?.url.replaceAll('{w}','480').replaceAll('{h}','480'));if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/^is\d+-ssl\.mzstatic\.com$/.test(u.hostname))m.coverUrl=u.href;}catch {}
    return m;
  }
  const apple={status:appleStatus,capabilities:{search:true,metadata:true,browse:true,playbackMode:'OFFICIAL_EMBED'},async browse(q='',offset=0,limit=20) {
    // Charts expose a bounded current list, not an enumerable copy of the catalog.
    if(!q&&offset)return {items:[],next:null};
    const d=await appleRequest(q?'search':'charts',{types:'songs',limit:String(limit),...(q?{term:q,offset:String(offset)}:{chart:'most-played'})});
    const list=q?d.results?.songs?.data:d.results?.songs?.[0]?.data;
    if(!Array.isArray(list))throw new CatalogError('APPLE_MUSIC_RESPONSE_INVALID',502);
    return {items:list.map(t=>{try{return appleTrack(t);}catch{return null;}}).filter(Boolean),next:q&&d.results?.songs?.next&&offset+limit<1000?offset+limit:null};
  },async getTrack(id){if(!/^\d{1,32}$/.test(id))throw new CatalogError('APPLE_MUSIC_ID_INVALID');const d=await appleRequest(`songs/${id}`);if(!d.data?.length)throw new CatalogError('APPLE_MUSIC_HTTP_404',404);return appleTrack(d.data[0]);}};
  const youtubeStatus=()=>env.YOUTUBE_API_KEY?'CONFIGURED':'NOT_CONFIGURED';
  async function youtubeRequest(path,params) {
    if(youtubeStatus()!=='CONFIGURED')throw new CatalogError('YOUTUBE_NOT_CONFIGURED',503);
    // Key stays in a request header and never enters a browser URL or error body.
    return json(new URL('/youtube/v3/'+path+'?'+new URLSearchParams(params),'https://www.googleapis.com'),'YOUTUBE',{'X-Goog-Api-Key':env.YOUTUBE_API_KEY});
  }
  function youtubeTrack(v) {
    if(!/^[\w-]{11}$/.test(v?.id)||!v.snippet?.title||!v.snippet.channelTitle||v.status?.privacyStatus!=='public'||v.status?.embeddable!==true||v.snippet.categoryId!=='10')return null;
    const d=String(v.contentDetails?.duration || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    const seconds=d?Number(d[1]||0)*3600+Number(d[2]||0)*60+Number(d[3]||0):0;
    const m=common('YOUTUBE',v.id,v.snippet.title,v.snippet.channelTitle,`https://www.youtube.com/watch?v=${v.id}`,Math.min(36000,seconds));
    // channelTitle identifies the uploader, never a guessed recording performer.
    m.artistLabelKind='UPLOADER';m.coverUrl=`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;return m;
  }
  const youtube={status:youtubeStatus,capabilities:{search:true,metadata:true,browse:true,playbackMode:'OFFICIAL_EMBED'},async browse(q='',token=null,limit=20) {
    const params={part:'snippet,contentDetails,status',maxResults:String(limit),...(token?{pageToken:token}:{})};
    let d;
    if(q) {
      const found=await youtubeRequest('search',{part:'snippet',type:'video',videoCategoryId:'10',videoEmbeddable:'true',q,maxResults:String(limit),...(token?{pageToken:token}:{})});
      if(!Array.isArray(found.items))throw new CatalogError('YOUTUBE_RESPONSE_INVALID',502);
      const ids=found.items.map(v=>v.id?.videoId).filter(id=>/^[\w-]{11}$/.test(id || ''));
      d=ids.length?await youtubeRequest('videos',{part:params.part,id:ids.join(',')}):{items:[]};
      d.nextPageToken=found.nextPageToken;
    } else d=await youtubeRequest('videos',{...params,chart:'mostPopular',videoCategoryId:'10'});
    if(!Array.isArray(d.items))throw new CatalogError('YOUTUBE_RESPONSE_INVALID',502);
    return {items:d.items.map(youtubeTrack).filter(Boolean),next:/^[\w-]{1,160}$/.test(d.nextPageToken || '')?d.nextPageToken:null};
  },async getTrack(id){if(!/^[\w-]{11}$/.test(id))throw new CatalogError('YOUTUBE_ID_INVALID');const d=await youtubeRequest('videos',{part:'snippet,contentDetails,status',id});const m=youtubeTrack(d.items?.[0]);if(!m)throw new CatalogError('EXTERNAL_TRACK_UNAVAILABLE',409);return m;}};
  return {APPLE_MUSIC:apple,YOUTUBE:youtube};
}
function createCatalogFeed(adapters) {
  const statuses=()=>['AUDIUS','SPOTIFY','SOUNDCLOUD','APPLE_MUSIC','YOUTUBE'].map(provider=>({provider,status:adapters[provider]?.status() || 'PERMISSION_REQUIRED',capabilities:adapters[provider]?.capabilities || {search:false,metadata:false,browse:false,playbackMode:provider==='SPOTIFY'?'LINK_OUT':'OFFICIAL_EMBED'}}));
  async function browse(q='',cursor='',limit=20) {
    const queryHash=createHash('sha256').update(q).digest('hex').slice(0,16);
    let positions={AUDIUS:0,APPLE_MUSIC:0,YOUTUBE:null};
    if(cursor) {
      try {
        if(!/^[\w-]{1,600}$/.test(cursor))throw 0;
        const decoded=JSON.parse(Buffer.from(cursor,'base64url').toString());
        if(decoded.q!==queryHash||Object.keys(decoded).length!==2||Object.keys(decoded.p).length!==3)throw 0;
        const p=decoded.p;
        if(!['AUDIUS','APPLE_MUSIC'].every(k=>p[k]===null||(Number.isInteger(p[k])&&p[k]>=0&&p[k]<=1000))||!(p.YOUTUBE===null||p.YOUTUBE===false||/^[\w-]{1,160}$/.test(p.YOUTUBE)))throw 0;
        positions=p;
      }catch {throw new CatalogError('EXTERNAL_CURSOR_INVALID');}
    }
    const reports=await Promise.all(SEARCH_PROVIDERS.map(async provider=>{
      const a=adapters[provider],pos=positions[provider];
      if(!a||a.status()==='DISABLED'||(provider!=='AUDIUS'&&a.status()==='NOT_CONFIGURED'))return {provider,status:a?.status() || 'NOT_CONFIGURED',items:[],next:provider==='YOUTUBE'?false:null};
      if(cursor&&(provider==='YOUTUBE'?pos===false:pos===null))return {provider,status:a.status(),items:[],next:pos};
      try {const data=await a.browse(q,pos,limit);return {provider,status:'LIVE',...data,next:provider==='YOUTUBE'?(data.next || false):data.next};}
      catch(e) {return {provider,status:'ERROR',error:e instanceof CatalogError?e.code:'PROVIDER_UNAVAILABLE',items:[],next:provider==='YOUTUBE'?false:null};}
    }));
    const p=Object.fromEntries(reports.map(r=>[r.provider,r.next]));
    const nextCursor=reports.some(r=>r.provider==='YOUTUBE'?r.next!==false:r.next!==null)?Buffer.from(JSON.stringify({q:queryHash,p})).toString('base64url'):null;
    // Round-robin retains each provider's ranking; no fabricated cross-service score.
    const items=[];for(let i=0;i<limit;i++)for(const r of reports)if(r.items[i])items.push(r.items[i]);
    return {items,providers:statuses().map(s=>({...s,...Object.fromEntries(Object.entries(reports.find(r=>r.provider===s.provider)||{}).filter(([k])=>['status','error'].includes(k)))})),pageInfo:{nextCursor,hasNextPage:Boolean(nextCursor)}};
  }
  return {browse,statuses};
}
module.exports={createCatalogAdapters,createCatalogFeed};
