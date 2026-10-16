'use strict';
const crypto = require('node:crypto');
const C = require('../lib/externalCatalog');
const { createImportTokens } = require('../lib/importTokens');
const { playlistLink, rankCandidates, MAX_IMPORT_TRACKS } = require('../lib/playlistImport');
const { publicTrackWhere } = require('../lib/publicVisibility');
const { createPlaylistSources } = require('../providers/playlistSources');
const { auditData } = require('../lib/auditLog');
const { sourceItem, sourcePlayback, sourcePlaylistView, sourcePlaylistPlayback } = require('../lib/sourcePlaylist');
const body = (properties, required=Object.keys(properties)) => ({body:{type:'object',additionalProperties:false,properties,required}});
const text = (maxLength=300) => ({type:'string',minLength:1,maxLength});
const rate = max => ({rateLimit:{max,timeWindow:'1 minute',keyGenerator:request=>request.user?.id || request.ip}});

module.exports = async function playlistImportRoutes(fastify, options) {
  const env=options.env || process.env, sources=options.sources || createPlaylistSources({env});
  const tokens=createImportTokens(env.COOKIE_SECRET);
  const sessionKey=request=>crypto.createHash('sha256').update(request.user.id+':'+request.sessionId).digest('hex');
  const cookieOptions={httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',path:'/api/playlist-import',maxAge:900};
  const connection=request=>{
    const value=tokens.open(request.cookies?.ns_spotify_import,'spotify-access');
    return value?.session===sessionKey(request) && value.tokenExpires>Date.now()?value:null;
  };
  fastify.addHook('preValidation',fastify.authenticate);
  fastify.addHook('onSend',async(_request,reply,payload)=>{reply.header('cache-control','private, no-store');return payload;});
  fastify.setErrorHandler((error,_request,reply)=>{
    const known=error instanceof C.CatalogError;
    const status=known?error.statusCode:error.validation?400:error.statusCode>=400&&error.statusCode<500?error.statusCode:500;
    if(status>=500 && !known)fastify.log.error({code:error.code || 'IMPORT_FAILED'},'Playlist import failed');
    reply.code(status).send({error:known?error.code:error.validation?'IMPORT_INPUT_INVALID':status===429?'IMPORT_RATE_LIMITED':'IMPORT_FAILED'});
  });
  fastify.get('/status',{config:rate(30)},async request=>({providers:sources.capabilities(),spotifyConnected:Boolean(connection(request)),maxTracks:MAX_IMPORT_TRACKS}));
  fastify.post('/spotify/connect',{config:rate(5)},async(request,reply)=>{
    if(!sources.capabilities().SPOTIFY)C.fail('IMPORT_NOT_CONFIGURED',409);
    const redirect=new URL(env.SPOTIFY_REDIRECT_URI);
    if(redirect.protocol!=='https:' && !(redirect.protocol==='http:'&&redirect.hostname==='127.0.0.1'))C.fail('IMPORT_NOT_CONFIGURED',409);
    const state=crypto.randomBytes(24).toString('base64url'),verifier=crypto.randomBytes(48).toString('base64url');
    reply.setCookie('ns_spotify_state',tokens.seal({state,verifier,session:sessionKey(request)},'spotify-state',600000),{...cookieOptions,maxAge:600});
    const url=new URL('https://accounts.spotify.com/authorize');
    url.search=new URLSearchParams({client_id:env.SPOTIFY_CLIENT_ID,response_type:'code',redirect_uri:env.SPOTIFY_REDIRECT_URI,scope:'playlist-read-private playlist-read-collaborative',state,code_challenge_method:'S256',code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')});
    return {url:url.href};
  });
  fastify.get('/spotify/callback',{config:rate(10)},async(request,reply)=>{
    const state=tokens.open(request.cookies?.ns_spotify_state,'spotify-state');
    reply.clearCookie('ns_spotify_state',cookieOptions);
    if(!state || state.session!==sessionKey(request) || state.state!==request.query.state || typeof request.query.code!=='string' || request.query.code.length>2000)C.fail('IMPORT_OAUTH_INVALID',400);
    const access=await sources.spotifyExchange(request.query.code,state.verifier);
    reply.setCookie('ns_spotify_import',tokens.seal({session:sessionKey(request),access:access.access,tokenExpires:access.expires},'spotify-access'),cookieOptions);
    const target=new URL('/library',String(env.FRONTEND_ORIGIN||'http://localhost:5173').split(',')[0].trim());
    target.searchParams.set('import','spotify');
    return reply.redirect(target.href);
  });
  fastify.delete('/spotify',{config:rate(10)},async(_request,reply)=>{reply.clearCookie('ns_spotify_import',cookieOptions);return {connected:false};});
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

  async function ownedSource(request) {
    const playlist=await fastify.prisma.playlist.findUnique({where:{id:request.params.id},select:{id:true,creatorId:true,isPublic:true,sourceImport:true}});
    if(!playlist || playlist.creatorId!==request.user.id || playlist.isPublic || !sourcePlaylistView(playlist))C.fail('IMPORT_PLAYLIST_INACCESSIBLE',404);
    return playlist;
  }
  fastify.get('/source/:id/status',{config:rate(30)},async request=>{
    await ownedSource(request);return {enabled:true};
  });
  fastify.get('/source/:id/playback/:position',{config:rate(60)},async request=>{
    const playlist=await ownedSource(request);
    if(request.params.position==='playlist') {
      const playback=sourcePlaylistPlayback(playlist.sourceImport);
      if(!playback)C.fail('IMPORT_TRACK_UNAVAILABLE',409);
      return {...playback,provider:playlist.sourceImport.provider,playbackMode:'OFFICIAL_EMBED',accessScope:'playlist-import',playlistId:playlist.id,wholePlaylist:true,total:playlist.sourceImport.items.length};
    }
    if(!/^\d{1,4}$/.test(request.params.position))C.fail('IMPORT_INPUT_INVALID',400);
    const position=Number(request.params.position),item=playlist.sourceImport.items[position];
    const playback=item && !item.unavailable && sourcePlayback(playlist.sourceImport.provider,item.sourceId);
    if(!playback)C.fail('IMPORT_TRACK_UNAVAILABLE',409);
    return {...playback,provider:playlist.sourceImport.provider,playbackMode:'OFFICIAL_EMBED',accessScope:'playlist-import',playlistId:playlist.id,position,total:playlist.sourceImport.items.length};
  });
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
