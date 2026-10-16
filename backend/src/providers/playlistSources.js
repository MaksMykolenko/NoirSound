'use strict';
const { CatalogError } = require('../lib/externalCatalog');
const { playlistLink, MAX_IMPORT_TRACKS } = require('../lib/playlistImport');

function createPlaylistSources({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  let soundcloudToken, soundcloudPending;
  async function json(url, options = {}) {
    let response;
    try { response = await fetchImpl(url, { ...options, redirect:'manual', signal: options.signal || AbortSignal.timeout(10000) }); }
    catch { throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502); }
    if (response.status===302 && new URL(url).origin==='https://api.soundcloud.com' && new URL(url).pathname==='/resolve') {
      await response.body?.cancel();
      let target;try{target=new URL(response.headers.get('location'));}catch{throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502);}
      if(target.origin!=='https://api.soundcloud.com'||target.username||target.password||target.search||target.hash||!/^\/playlists\/(?:soundcloud:playlists:)?\d+$/.test(decodeURIComponent(target.pathname)))throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502);
      return json(target.href,options);
    }
    if (!response.ok) {
      await response.body?.cancel();
      const code = response.status === 401 ? 'IMPORT_CONNECT_REQUIRED' : response.status === 403 || response.status === 404 ? 'IMPORT_PLAYLIST_INACCESSIBLE' : response.status === 429 ? 'IMPORT_RATE_LIMITED' : 'IMPORT_PROVIDER_UNAVAILABLE';
      throw new CatalogError(code, response.status === 429 ? 429 : 502);
    }
    const reader=response.body.getReader(), chunks=[]; let size=0;
    try { for(;;) { const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw new CatalogError('IMPORT_RESPONSE_TOO_LARGE',502);chunks.push(value); } }
    finally { await reader.cancel(); }
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502); }
  }
  function capabilities() {
    return { SPOTIFY: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_REDIRECT_URI), YOUTUBE: Boolean(env.YOUTUBE_API_KEY), SOUNDCLOUD: Boolean(env.SOUNDCLOUD_CLIENT_ID && env.SOUNDCLOUD_CLIENT_SECRET) };
  }
  async function scToken() {
    if (soundcloudToken?.expires > Date.now()+30000) return soundcloudToken.access;
    if (!soundcloudPending) soundcloudPending = (async () => {
      const data=await json('https://secure.soundcloud.com/oauth/token', {method:'POST',headers:{Authorization:'Basic '+Buffer.from(env.SOUNDCLOUD_CLIENT_ID+':'+env.SOUNDCLOUD_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(soundcloudToken?.refresh ? {grant_type:'refresh_token',refresh_token:soundcloudToken.refresh} : {grant_type:'client_credentials'})});
      if (!data.access_token) throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502);
      soundcloudToken={access:data.access_token,refresh:data.refresh_token,expires:Date.now()+Math.min(Number(data.expires_in)||3600,3600)*1000};
      return soundcloudToken.access;
    })().finally(()=>{soundcloudPending=null;});
    return soundcloudPending;
  }
  async function load(link, spotifyToken) {
    const parsed=playlistLink(link), provider=parsed.provider;
    if (!capabilities()[provider]) throw new CatalogError('IMPORT_NOT_CONFIGURED',409);
    const entries=[]; let name=provider+' playlist', total=0, skipped=0, truncated=false;
    // One total deadline across all pages; pagination URLs from providers are never fetched verbatim.
    const signal=AbortSignal.timeout(25000);
    if (provider==='SPOTIFY') {
      if(!spotifyToken)throw new CatalogError('IMPORT_CONNECT_REQUIRED',409);
      const headers={Authorization:'Bearer '+spotifyToken};
      const meta=await json('https://api.spotify.com/v1/playlists/'+parsed.id+'?fields=name,snapshot_id',{headers,signal});name=meta.name || name;
      for(let offset=0;offset<MAX_IMPORT_TRACKS;offset+=50) {
        const page=await json('https://api.spotify.com/v1/playlists/'+parsed.id+'/items?limit=50&offset='+offset,{headers,signal});
        if(!Array.isArray(page.items))throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502);
        total=Number(page.total)||total;
        for(const row of page.items) {
          const track=row.item || row.track;
          if(row.is_local || !track || track.type!=='track' || !track.name) { skipped++;continue; }
          entries.push({title:track.name.slice(0,300),artist:(track.artists||[]).map(a=>a.name).join(', ').slice(0,200),duration:Number(track.duration_ms)/1000 || null});
        }
        if(!page.next)break;
        if(offset+50>=MAX_IMPORT_TRACKS)truncated=true;
      }
      const after=await json('https://api.spotify.com/v1/playlists/'+parsed.id+'?fields=snapshot_id',{headers,signal});
      if(meta.snapshot_id && after.snapshot_id!==meta.snapshot_id)throw new CatalogError('IMPORT_PLAYLIST_CHANGED',409);
    } else if (provider==='YOUTUBE') {
      const api=(path,query)=>json('https://www.googleapis.com/youtube/v3/'+path+'?'+new URLSearchParams({...query,key:env.YOUTUBE_API_KEY}),{signal});
      const meta=await api('playlists',{part:'snippet',id:parsed.id});
      if(!meta.items?.length)throw new CatalogError('IMPORT_PLAYLIST_INACCESSIBLE',404);
      name=meta.items[0].snippet.title;
      let token='';
      for(let pageIndex=0;pageIndex<4;pageIndex++) {
        const page=await api('playlistItems',{part:'snippet,contentDetails',playlistId:parsed.id,maxResults:'50',...(token?{pageToken:token}:{})});
        if(!Array.isArray(page.items))throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502);
        total=Number(page.pageInfo?.totalResults)||total;
        for(const item of page.items) {
          const raw=item.snippet?.title;
          if(!raw || ['Deleted video','Private video'].includes(raw)){skipped++;continue;}
          const parts=raw.match(/^(.+?)\s+[-–—]\s+(.+)$/);
          entries.push({title:(parts?.[2]||raw).slice(0,300),artist:(parts?.[1]||item.snippet.videoOwnerChannelTitle||'').replace(/ - Topic$/,'').slice(0,200),duration:null,needsReview:true});
        }
        token=page.nextPageToken;if(!token)break;if(pageIndex===3)truncated=true;
      }
    } else {
      const headers={Authorization:'OAuth '+await scToken()};
      const playlist=await json('https://api.soundcloud.com/resolve?'+new URLSearchParams({url:parsed.url}),{headers,signal});
      const urn=playlist.urn || (playlist.id?'soundcloud:playlists:'+playlist.id:'');
      if(playlist.kind!=='playlist' || !/^soundcloud:playlists:\d+$/.test(urn))throw new CatalogError('IMPORT_PLAYLIST_INACCESSIBLE',404);
      name=playlist.title || name;total=Number(playlist.track_count)||0;
      const path='/playlists/'+encodeURIComponent(urn)+'/tracks';
      let query=new URLSearchParams({linked_partitioning:'true',limit:'50'});
      for(let pageIndex=0;pageIndex<4;pageIndex++) {
        const page=await json('https://api.soundcloud.com'+path+'?'+query,{headers,signal});
        const items=Array.isArray(page)?page:page.collection;
        if(!Array.isArray(items))throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502);
        for(const track of items) {
          if(!track.title){skipped++;continue;}
          entries.push({title:track.title.slice(0,300),artist:(track.metadata_artist || track.user?.username || '').slice(0,200),duration:Number(track.duration)/1000 || null,needsReview:!track.metadata_artist});
        }
        if(!page.next_href)break;
        if(pageIndex===3||entries.length>=MAX_IMPORT_TRACKS){truncated=true;break;}
        let next;try{next=new URL(page.next_href);}catch{throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502);}
        if(next.origin!=='https://api.soundcloud.com'||next.username||next.password||next.hash||decodeURIComponent(next.pathname)!==decodeURIComponent(path))throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502);
        query=new URLSearchParams({linked_partitioning:'true',limit:'50'});
        for(const key of ['offset','cursor']){const value=next.searchParams.get(key);if(value&&value.length<500)query.set(key,value);}
        if(!query.has('offset')&&!query.has('cursor'))throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE',502);
      }
      if(entries.length>MAX_IMPORT_TRACKS)truncated=true;
    }
    return {provider,name:String(name).slice(0,120),entries:entries.slice(0,MAX_IMPORT_TRACKS),total:total||entries.length+skipped,skipped,truncated};
  }
  async function spotifyExchange(code, verifier) {
    const data=await json('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:env.SPOTIFY_REDIRECT_URI,client_id:env.SPOTIFY_CLIENT_ID,code_verifier:verifier})});
    if(!data.access_token)throw new CatalogError('IMPORT_CONNECT_REQUIRED',409);
    return {access:data.access_token,expires:Date.now()+Math.min(Number(data.expires_in)||900,900)*1000};
  }
  return {capabilities,load,spotifyExchange};
}
module.exports={createPlaylistSources};
