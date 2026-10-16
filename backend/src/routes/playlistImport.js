'use strict';
const crypto = require('node:crypto');
const C = require('../lib/externalCatalog');
const { createImportTokens } = require('../lib/importTokens');
const { playlistLink, rankCandidates, candidateScore, MAX_IMPORT_TRACKS } = require('../lib/playlistImport');
const { publicTrackWhere } = require('../lib/publicVisibility');
const { createPlaylistSources } = require('../providers/playlistSources');
const { auditData } = require('../lib/auditLog');
const { sourceItem, sourcePlaylistView } = require('../lib/sourcePlaylist');
const { createSpotifyPlayback, SCOPES, hasPlaybackScopes } = require('../providers/spotifyPlayback');
const body = (properties, required=Object.keys(properties)) => ({body:{type:'object',additionalProperties:false,properties,required}});
const text = (maxLength=300) => ({type:'string',minLength:1,maxLength});
const rate = max => ({rateLimit:{max,timeWindow:'1 minute',keyGenerator:request=>request.user?.id || request.ip}});

module.exports = async function playlistImportRoutes(fastify, options) {
  const env=options.env || process.env, sources=options.sources || createPlaylistSources({env});
  const spotify=options.spotifyPlayback || createSpotifyPlayback({env});
  const tokens=createImportTokens(env.COOKIE_SECRET);
  const sessionKey=request=>crypto.createHash('sha256').update(request.user.id+':'+request.sessionId).digest('hex');
  const cookieOptions={httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',path:'/api/playlist-import',maxAge:900};
  const connection=request=>{
    const value=tokens.open(request.cookies?.ns_spotify_import,'spotify-access');
    return value?.session===sessionKey(request) && value.tokenExpires>Date.now()?value:null;
  };
  const playbackCookie = {...cookieOptions,maxAge:8*3600};
  const playbackConnection = request => {
    const value=tokens.open(request.cookies?.ns_spotify_playback,'spotify-playback');
    return value?.session===sessionKey(request) && hasPlaybackScopes(value.scope)?value:null;
  };
  async function playbackAccess(request,reply) {
    let value=playbackConnection(request);
    if(!value)C.fail('SPOTIFY_PLAYBACK_CONNECT',409);
    if(value.tokenExpires<Date.now()+30000) {
      if(!value.refresh)C.fail('SPOTIFY_PLAYBACK_CONNECT',409);
      const fresh=await spotify.refresh(value.refresh);
      value={...value,...fresh,scope:fresh.scope || value.scope};
      if(!hasPlaybackScopes(value.scope))C.fail('SPOTIFY_PLAYBACK_CONNECT',409);
      // Refresh never extends the original eight-hour connection window.
      const remaining=value.expires-Date.now();
      if(remaining<=0)C.fail('SPOTIFY_PLAYBACK_CONNECT',409);
      reply.setCookie('ns_spotify_playback',tokens.seal(value,'spotify-playback',remaining),{...playbackCookie,maxAge:Math.floor(remaining/1000)});
    }
    return value;
  }
  fastify.addHook('preValidation',fastify.authenticate);
  fastify.addHook('onSend',async(_request,reply,payload)=>{reply.header('cache-control','private, no-store');return payload;});
  fastify.setErrorHandler((error,_request,reply)=>{
    const known=error instanceof C.CatalogError;
    const status=known?error.statusCode:error.validation?400:error.statusCode>=400&&error.statusCode<500?error.statusCode:500;
    if(status>=500 && !known)fastify.log.error({code:error.code || 'IMPORT_FAILED'},'Playlist import failed');
    reply.code(status).send({error:known?error.code:error.validation?'IMPORT_INPUT_INVALID':status===429?'IMPORT_RATE_LIMITED':'IMPORT_FAILED'});
  });
  fastify.get('/status',{config:rate(30)},async request=>({providers:sources.capabilities(),spotifyConnected:Boolean(connection(request)),spotifyPlaybackConnected:Boolean(playbackConnection(request)),maxTracks:MAX_IMPORT_TRACKS}));
  fastify.post('/spotify/connect',{config:rate(5),schema:body({playback:{type:'boolean'},playlistId:{type:'string',pattern:'^[a-f0-9-]{36}$'}},[])},async(request,reply)=>{
    if(!sources.capabilities().SPOTIFY)C.fail('IMPORT_NOT_CONFIGURED',409);
    const redirect=new URL(env.SPOTIFY_REDIRECT_URI);
    if(redirect.protocol!=='https:' && !(redirect.protocol==='http:'&&redirect.hostname==='127.0.0.1'))C.fail('IMPORT_NOT_CONFIGURED',409);
    const playback=request.body?.playback===true,playlistId=request.body?.playlistId;
    if(playback && playlistId)await ownedSource({...request,params:{id:playlistId}});
    const state=crypto.randomBytes(24).toString('base64url'),verifier=crypto.randomBytes(48).toString('base64url');
    reply.setCookie('ns_spotify_state',tokens.seal({state,verifier,session:sessionKey(request),playback,playlistId},'spotify-state',600000),{...cookieOptions,maxAge:600});
    const url=new URL('https://accounts.spotify.com/authorize');
    url.search=new URLSearchParams({client_id:env.SPOTIFY_CLIENT_ID,response_type:'code',redirect_uri:env.SPOTIFY_REDIRECT_URI,scope:['playlist-read-private','playlist-read-collaborative',...(playback?SCOPES:[])].join(' '),state,code_challenge_method:'S256',code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')});
    return {url:url.href};
  });
  fastify.get('/spotify/callback',{config:rate(10)},async(request,reply)=>{
    const state=tokens.open(request.cookies?.ns_spotify_state,'spotify-state');
    reply.clearCookie('ns_spotify_state',cookieOptions);
    if(!state || state.session!==sessionKey(request) || state.state!==request.query.state || typeof request.query.code!=='string' || request.query.code.length>2000)C.fail('IMPORT_OAUTH_INVALID',400);
    const access=await sources.spotifyExchange(request.query.code,state.verifier);
    reply.setCookie('ns_spotify_import',tokens.seal({session:sessionKey(request),access:access.access,tokenExpires:access.expires},'spotify-access'),cookieOptions);
    if(state.playback) {
      if(!hasPlaybackScopes(access.scope))C.fail('SPOTIFY_PLAYBACK_CONNECT',409);
      reply.setCookie('ns_spotify_playback',tokens.seal({session:sessionKey(request),access:access.access,refresh:access.refresh,scope:access.scope,tokenExpires:access.expires},'spotify-playback',8*3600000),playbackCookie);
    }
    const target=new URL(state.playback && state.playlistId ? '/playlist/'+state.playlistId : '/library',String(env.FRONTEND_ORIGIN||'http://localhost:5173').split(',')[0].trim());
    target.searchParams.set(state.playback?'spotify':'import',state.playback?'connected':'spotify');
    return reply.redirect(target.href);
  });
  fastify.delete('/spotify',{config:rate(10)},async(_request,reply)=>{reply.clearCookie('ns_spotify_import',cookieOptions);reply.clearCookie('ns_spotify_playback',playbackCookie);return {connected:false};});
  fastify.post('/preview',{config:rate(5),schema:body({url:text(1000)})},async request=>{
    const parsed=playlistLink(request.body.url);
    const loaded=await sources.load(request.body.url,connection(request)?.access);
    const provider=parsed.provider;
    const sourceUrl=provider==='SPOTIFY'?'https://open.spotify.com/playlist/'+parsed.id:provider==='YOUTUBE'?'https://www.youtube.com/playlist?list='+parsed.id:parsed.url;
    const id=crypto.randomUUID();
    const entries=loaded.entries.map((entry,position)=>{
      const item=sourceItem(provider,entry);
      return {...item,selection:tokens.seal({user:request.user.id,previewId:id,position,item},'source-selection')};
    });
    const preview=tokens.seal({id,user:request.user.id,session:sessionKey(request),provider,sourceUrl,total:loaded.total,loaded:entries.length,truncated:Boolean(loaded.truncated)},'source-preview');
    return {...loaded,provider,entries,preview,unavailable:entries.filter(entry=>entry.unavailable).length};
  });

  async function ownedSource(request,db=fastify.prisma) {
    const playlist=await db.playlist.findUnique({where:{id:request.params.id},select:{id:true,creatorId:true,isPublic:true,sourceImport:true}});
    if(!playlist || playlist.creatorId!==request.user.id || playlist.isPublic || !sourcePlaylistView(playlist))C.fail('IMPORT_PLAYLIST_INACCESSIBLE',404);
    return playlist;
  }
  fastify.get('/source/:id/status',{config:rate(30)},async request=>{
    await ownedSource(request);return {enabled:true};
  });
  function sourcePosition(playlist,value) {
    if(value!=='playlist'&&!/^\d{1,4}$/.test(value))C.fail('IMPORT_INPUT_INVALID',400);
    const view=sourcePlaylistView(playlist,true);
    const position=value==='playlist'?view.items.findIndex(item=>item.playbackMode==='IMPORTED_SOURCE'):Number(value);
    const track=view.items[position];
    if(!track || track.playbackMode!=='IMPORTED_SOURCE')C.fail('IMPORT_TRACK_UNAVAILABLE',409);
    return {track,position,view};
  }
  fastify.get('/spotify/playback-token',{config:rate(60)},async(request,reply)=>{
    const value=await playbackAccess(request,reply);
    return {accessToken:value.access,expiresAt:value.tokenExpires};
  });
  fastify.post('/source/:id/spotify/play/:position',{config:rate(60),schema:body({deviceId:{type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'}})},async(request,reply)=>{
    const playlist=await ownedSource(request);
    const {track}=sourcePosition(playlist,request.params.position);
    if(track.provider!=='SPOTIFY')C.fail('IMPORT_TRACK_UNAVAILABLE',409);
    const value=await playbackAccess(request,reply);
    await spotify.play(value.access,request.body.deviceId,track.sourceId);
    return {playing:true};
  });
  fastify.get('/source/:id/playback/:position',{config:rate(60)},async request=>{
    const playlist=await ownedSource(request);
    const {track,position,view}=sourcePosition(playlist,request.params.position);
    const common={accessScope:'playlist-import',playlistId:playlist.id,position,total:view.total,track,...(request.params.position==='playlist'?{sourceQueue:view.items}:{})};
    if(track.provider==='SPOTIFY')return {...common,provider:'SPOTIFY',playbackMode:'SPOTIFY_SDK',uri:'spotify:track:'+track.sourceId};
    // A metadata import is not an audio URL. Only an unambiguous full native
    // recording can use the HTML audio engine; no hidden provider widgets.
    const candidates=await fastify.prisma.track.findMany({where:publicTrackWhere({processedAudioKey:{not:null},title:{equals:track.title,mode:'insensitive'}}),include:{artist:{include:{user:{select:{displayName:true}}}}},take:10});
    const matches=candidates.filter(item=>candidateScore({title:track.title,artist:track.artistName,duration:track.duration},{title:item.title,artistName:item.primaryArtistName||item.artist.user.displayName,duration:item.durationSeconds||item.duration})>=90);
    if(matches.length!==1)C.fail('IMPORT_AUDIO_UNAVAILABLE',409);
    return {...common,provider:'NOIRSOUND',playbackMode:'NATIVE',nativeTrackId:matches[0].id};
  });
  // Stale clients cannot reopen the removed version picker or mutate choices.
  for(const path of ['/source/:id/alternatives/:position','/source/:id/choice/:position']) {
    fastify.post(path,{config:rate(10)},async request=>{await ownedSource(request);C.fail('IMPORT_PLAYER_REPLACED',410);});
  }
  fastify.post('/matches',{config:rate(60),schema:body({entries:{type:'array',minItems:1,maxItems:5,items:{type:'object',additionalProperties:false,required:['title','artist'],properties:{title:text(),artist:{type:'string',maxLength:200},duration:{anyOf:[{type:'number',minimum:0,maximum:36000},{type:'null'}]},needsReview:{type:'boolean'}}}}})},async request=>{
    const results=await Promise.all(request.body.entries.map(async entry=>{
      const native=await fastify.prisma.track.findMany({where:publicTrackWhere({processedAudioKey:{not:null},title:{contains:entry.title,mode:'insensitive'}}),include:{artist:{include:{user:{select:{displayName:true}}}}},take:10});
      const candidates=native.map(track=>({key:'native:'+track.id,title:track.title,artistName:track.primaryArtistName||track.artist.user.displayName,duration:track.durationSeconds||track.duration,provider:'NOIRSOUND',selection:tokens.seal({user:request.user.id,trackId:track.id},'selection')}));
      return rankCandidates(entry,candidates);
    }));
    return {results};
  });
  fastify.post('/commit',{bodyLimit:4*1024*1024,config:rate(5),schema:body({name:text(120),requestId:{type:'string',pattern:'^[a-f0-9-]{36}$'},mode:{type:'string',enum:['source']},preview:text(8000),selections:{type:'array',minItems:1,maxItems:MAX_IMPORT_TRACKS,items:text(8000)}},['name','requestId','selections'])},async request=>{
    if(!request.body.name.trim())C.fail('IMPORT_INPUT_INVALID');
    // Stable, user-scoped id makes a retried confirmation atomic and idempotent.
    const hex=crypto.createHash('sha256').update('playlist-import:'+request.user.id+':'+request.body.requestId).digest('hex');
    const id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);
    return fastify.prisma.$transaction(async tx=>{
      await C.catalogLock(tx);
      const existing=await tx.playlist.findUnique({where:{id},include:{_count:{select:{tracks:true}}}});
      if(existing)return {id:existing.id,name:existing.name,trackCount:sourcePlaylistView(existing)?.total ?? existing._count.tracks,reused:true};
      if(request.body.mode==='source') {
        const preview=tokens.open(request.body.preview,'source-preview');
        if(!preview || preview.user!==request.user.id || preview.session!==sessionKey(request))C.fail('IMPORT_PREVIEW_EXPIRED',409);
        if(preview.truncated)C.fail('IMPORT_TOO_LARGE',409);
        if(preview.loaded!==request.body.selections.length)C.fail('IMPORT_INPUT_INVALID',400);
        const items=request.body.selections.map((value,position)=>{
          const selected=tokens.open(value,'source-selection');
          if(!selected || selected.user!==request.user.id || selected.previewId!==preview.id || selected.position!==position)C.fail('IMPORT_PREVIEW_EXPIRED',409);
          return sourceItem(preview.provider,selected.item);
        });
        const playlist=await tx.playlist.create({data:{id,name:request.body.name.trim(),creatorId:request.user.id,isPublic:false,tags:[],sourceImport:{version:1,provider:preview.provider,sourceUrl:preview.sourceUrl,items}}});
        await tx.auditLog.create({data:auditData(request.user.id,'PLAYLIST_IMPORT','PLAYLIST',playlist.id,'User imported source playlist',{provider:preview.provider,trackCount:items.length})});
        return {id:playlist.id,name:playlist.name,trackCount:items.length};
      }
    const picks=request.body.selections.map(value=>{
      const selected=tokens.open(value,'selection');
      if(!selected || selected.user!==request.user.id)C.fail('IMPORT_PREVIEW_EXPIRED',409);
      if(selected.metadata || typeof selected.trackId!=='string')C.fail('IMPORT_TRACK_UNAVAILABLE',409);
      return selected;
    });

      const ids=[];
      for(const pick of picks) {
        const trackId=pick.trackId;
        const native=await tx.track.findFirst({where:publicTrackWhere({id:trackId,processedAudioKey:{not:null}}),select:{id:true}});
        if(!native)C.fail('IMPORT_TRACK_UNAVAILABLE',409);
        if(!ids.includes(trackId))ids.push(trackId);
      }
      const playlist=await tx.playlist.create({data:{id,name:request.body.name.trim(),creatorId:request.user.id,isPublic:false,tags:[],tracks:{create:ids.map((trackId,order)=>({trackId,order}))}}});
      await tx.auditLog.create({data:auditData(request.user.id,'PLAYLIST_IMPORT','PLAYLIST',playlist.id,'User confirmed playlist import',{trackCount:ids.length,duplicates:picks.length-ids.length})});
      return {id:playlist.id,name:playlist.name,trackCount:ids.length,duplicates:picks.length-ids.length};
    },{timeout:20000});
  });
};
