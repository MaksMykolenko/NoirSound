'use strict';
const { CatalogError, platformUrl, versionFromTitle } = require('../lib/externalCatalog');
const ORIGIN = 'https://api.audius.co';
const CAPABILITIES = Object.freeze({search:true,resolve:true,metadata:true,playbackMode:'EXTERNAL_STREAM',publicAccess:true});
const validId = id => typeof id === 'string' && /^[A-Za-z0-9]{1,32}$/.test(id);
function createAudiusAdapter({fetchImpl=globalThis.fetch,env=process.env}={}) {
  let lastStatus = env.AUDIUS_ENABLED === 'false' ? 'DISABLED' : 'NOT_CONFIGURED';
  async function request(path,{method='GET',raw=false}={}) {
    if (env.AUDIUS_ENABLED === 'false') throw new CatalogError('AUDIUS_DISABLED',503);
    const url = new URL(path,ORIGIN);
    if (url.origin!==ORIGIN || !url.pathname.startsWith('/v1/')) throw new CatalogError('AUDIUS_URL_INVALID');
    for(let attempt=0;attempt<2;attempt++) {
      try {
        const res=await fetchImpl(url,{method,redirect:'manual',signal:AbortSignal.timeout(8000),headers:env.AUDIUS_BEARER_TOKEN?{Authorization:`Bearer ${env.AUDIUS_BEARER_TOKEN}`}:{}});
        if (res.status>=500 && attempt===0) { await res.body?.cancel();continue; }
        if ([401,403,404,429].includes(res.status) || res.status>=400) { await res.body?.cancel();throw new CatalogError(`AUDIUS_HTTP_${res.status}`,res.status===404?404:res.status===429?429:502); }
        if (raw) { await res.body?.cancel();lastStatus='LIVE';return res; }
        if (res.status>=300) { await res.body?.cancel();throw new CatalogError('AUDIUS_REDIRECT_REJECTED',502); }
        const reader = res.body.getReader();let total=0;const chunks=[];
        try { while(true) { const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>2_000_000)throw new CatalogError('AUDIUS_RESPONSE_TOO_LARGE',502);chunks.push(value); } } finally { await reader.cancel(); }
        let data;try { data=JSON.parse(Buffer.concat(chunks).toString()); } catch {throw new CatalogError('AUDIUS_RESPONSE_INVALID',502);}
        lastStatus='LIVE';return data.data;
      } catch(error) { lastStatus='ERROR';if(error instanceof CatalogError)throw error;if(attempt===1)throw new CatalogError('AUDIUS_UNAVAILABLE',502); }
    }
  }
  function metadata(t) {
    if (!t || !validId(t.id) || !t.title || !t.user?.name || !t.permalink) throw new CatalogError('AUDIUS_RESPONSE_INVALID',502);
    const link = platformUrl('AUDIUS',new URL(t.permalink,'https://audius.co').href);
    const allowed = t.is_streamable === true && t.is_available !== false && t.is_delete === false && t.is_unlisted === false && t.is_stream_gated === false && !t.stream_conditions && !t.allowed_api_keys?.length && !t.is_scheduled_release && !t.stem_of;
    let cover=null;const artwork=t.artwork?.['480x480'] || t.artwork?.['150x150'];
    if(artwork) { try {const u=new URL(artwork);if(u.protocol==='https:'&&!u.username&&!u.password&&/^\/content\/[A-Za-z0-9]+\/(150x150|480x480|1000x1000)\.jpg$/.test(u.pathname))cover='https://creatornode.audius.co'+u.pathname;}catch{} }
    return {externalId:t.id,canonicalUrl:link.canonicalUrl,title:t.title.slice(0,300),artistName:t.user.name.slice(0,200),coverUrl:cover,durationSeconds:Math.max(0,Math.min(36000,Math.round(Number(t.duration)||0))),versionType:versionFromTitle(t.title,t.remix_of),isrc:/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(t.isrc||'')?t.isrc:null,explicit:t.parental_warning_type==='Explicit',availability:allowed?'AVAILABLE':'UNAVAILABLE',playbackMode:allowed?'EXTERNAL_STREAM':'LINK_OUT',provenance:'AUDIUS_PUBLIC_API',checkedAt:new Date(),provider:'AUDIUS',officialStatus:'UNVERIFIED',matchStatus:'UNVERIFIED'};
  }
  async function getTrack(id) { if(!validId(id))throw new CatalogError('AUDIUS_ID_INVALID');return metadata(await request(`/v1/tracks/${id}`)); }
  async function resolve(url) {
    const link=platformUrl('AUDIUS',url);const response=await request('/v1/resolve?'+new URLSearchParams({url:link.canonicalUrl}),{raw:true});
    const location=response.headers.get('location');let u;try {u=new URL(location,ORIGIN);}catch {throw new CatalogError('AUDIUS_RESOLVE_INVALID',502);}
    const match=u.pathname.match(/^\/v1\/tracks\/([A-Za-z0-9]{1,32})$/);
    if(response.status!==302 || u.origin!==ORIGIN || !match || u.search || u.hash)throw new CatalogError('AUDIUS_RESOLVE_INVALID',502);
    return getTrack(match[1]);
  }
  async function search(query,offset=0,limit=20) {
    const data=await request('/v1/tracks/search?'+new URLSearchParams({query,offset:String(offset),limit:String(limit)}));
    if(!Array.isArray(data))throw new CatalogError('AUDIUS_RESPONSE_INVALID',502);
    return data.map(t=>{try{return metadata(t);}catch{return null;}}).filter(Boolean);
  }
  async function playback(id) {
    if(!validId(id))throw new CatalogError('AUDIUS_ID_INVALID');
    const raw=await request(`/v1/tracks/${id}`);const track=metadata(raw);if(track.availability!=='AVAILABLE')throw new CatalogError('EXTERNAL_TRACK_UNAVAILABLE',409);
    // Fresh official stream route, never persisted; use the signed Audius gateway.
    // No audio bytes, arbitrary URL or upstream credential enter the NoirSound server.
    const url=`${ORIGIN}/v1/tracks/${id}/stream?skip_play_count=true`;
    const res=await request(`/v1/tracks/${id}/stream?skip_play_count=true`,{method:'HEAD',raw:true});
    if(![200,206,302,307].includes(res.status))throw new CatalogError('EXTERNAL_TRACK_UNAVAILABLE',409);
    let streamUrl=url;
    if(res.status>=300){let u;try{u=new URL(res.headers.get('location'));}catch{throw new CatalogError('AUDIUS_STREAM_INVALID',502);}
      if(u.protocol!=='https:' || u.port || u.username || u.password || !/^[A-Za-z0-9]{20,100}$/.test(raw.track_cid || '') || u.pathname!==`/tracks/cidstream/${raw.track_cid}` || !u.searchParams.get('signature'))throw new CatalogError('AUDIUS_STREAM_INVALID',502);
      // The shared Audius gateway serves the same provider-signed CID. This
      // keeps the browser CSP and server destinations fixed across node mirrors.
      const gateway=new URL(u.pathname,'https://creatornode.audius.co');gateway.searchParams.set('signature',u.searchParams.get('signature'));gateway.searchParams.set('skip_play_count','true');
      let probe;try {probe=await fetchImpl(gateway,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(8000)});}catch {lastStatus='ERROR';throw new CatalogError('AUDIUS_UNAVAILABLE',502);}await probe.body?.cancel();
      if(![200,206].includes(probe.status))throw new CatalogError('EXTERNAL_TRACK_UNAVAILABLE',409);
      streamUrl=gateway.href;
    }
    return {track,url:streamUrl,expiresAt:new Date(Date.now()+60000).toISOString(),playbackMode:'EXTERNAL_STREAM',provider:'AUDIUS'};
  }
  return {capabilities:CAPABILITIES,getTrack,resolve,search,playback,status:()=>lastStatus};
}
module.exports={createAudiusAdapter,CAPABILITIES};
