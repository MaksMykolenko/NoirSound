import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import routes from '../src/routes/playlistImport';
import tokenModule from '../src/lib/importTokens';

describe('playlist import authorization and confirmation',()=>{
  let app,db,playlists,visible,sources,youtubeMatches;
  const entry={title:'Fixture',artist:'Artist',duration:180};
  const post=(path,payload,user='a')=>app.inject({method:'POST',url:'/api/playlist-import/'+path,headers:user?{'x-fixture-user':user}:{},payload});
  beforeEach(async()=>{
    visible=true;playlists=new Map();vi.stubEnv('EXTERNAL_CATALOG_PUBLIC','false');
    db={
      track:{findMany:vi.fn(async()=>[{id:'native',title:'Fixture',primaryArtistName:'Artist',durationSeconds:180}]),findFirst:vi.fn(async()=>visible?{id:'native'}:null)},
      playlist:{findUnique:vi.fn(async({where})=>playlists.get(where.id)),create:vi.fn(async({data})=>{playlists.set(data.id,{...data,_count:{tracks:data.tracks?.create.length||0}});return data;}),update:vi.fn(async({where,data})=>{Object.assign(playlists.get(where.id),data);return playlists.get(where.id);})},
      auditLog:{create:vi.fn(async()=>{})},$executeRaw:vi.fn(async()=>{}),
      $transaction:async fn=>fn(db),
    };
    sources={capabilities:()=>({SPOTIFY:true,YOUTUBE:false,SOUNDCLOUD:false}),load:vi.fn(async()=>({name:'Source playlist',entries:[entry]})),spotifyExchange:vi.fn(async()=>({access:'server-token',expires:Date.now()+900000}))};
    youtubeMatches={configured:vi.fn(()=>false),search:vi.fn(async()=>[{videoId:'abcdefghijk',title:'Artist — Fixture',channel:'Artist',duration:180}]),inspect:vi.fn()};
    app=Fastify();app.decorate('prisma',db);app.decorate('authenticate',async(request,reply)=>{
      if(!request.headers['x-fixture-user'])return reply.code(401).send({error:'Unauthorized'});
      request.user={id:request.headers['x-fixture-user'],role:'LISTENER'};request.sessionId='session-'+request.user.id;
    });
    await app.register(cookie);
    await app.register(routes,{prefix:'/api/playlist-import',sources,youtubeMatches,env:{COOKIE_SECRET:'test-only',SPOTIFY_CLIENT_ID:'fixture',SPOTIFY_REDIRECT_URI:'https://example.test/api/playlist-import/spotify/callback',FRONTEND_ORIGIN:'https://example.test'}});
    await app.ready();
  });
  afterEach(async()=>{await app.close();vi.unstubAllEnvs();});
  async function selection(){
    const response=await post('matches',{entries:[entry]});expect(response.statusCode,response.body).toBe(200);
    expect(db.track.findMany.mock.calls[0][0].where).toMatchObject({isPublic:true,catalogScope:'NATIVE',status:'PUBLISHED',artist:{isHidden:false,user:{status:'ACTIVE'}}});
    return response.json().results[0].candidates[0].selection;
  }
  it('requires a session even for previews',async()=>{
    expect((await post('preview',{url:'https://youtube.com/playlist?list=PLabcdefghijk'},null)).statusCode).toBe(401);
  });
  it.each([
    {fileText:'Artist - Fixture'},
    {url:'https://audius.co/fixture/playlist'},
    {url:'https://music.apple.com/us/playlist/fixture/pl.123'},
  ])('rejects removed import sources before contacting a provider: %j',async payload=>{
    expect((await post('preview',payload)).statusCode).toBe(400);
    expect(sources.load).not.toHaveBeenCalled();
  });
  it.each(['https://open.spotify.com/playlist/1234567890123456789012','https://youtube.com/playlist?list=PLabcdefghijk','https://soundcloud.com/fixture/sets/list'])('accepts a supported playlist link %s',async url=>{
    const response=await post('preview',{url});expect(response.statusCode,response.body).toBe(200);
    expect(sources.load).toHaveBeenCalledWith(url,undefined);
  });
  it('rejects an unexpired Audius selection issued before the source was removed',async()=>{
    const tokens=tokenModule.createImportTokens('test-only');
    const old=tokens.seal({user:'a',metadata:{provider:'AUDIUS',externalId:'old'}},'selection');
    const response=await post('commit',{name:'Old preview',requestId:'00000000-0000-4000-a000-000000000001',selections:[old]});
    expect(response.statusCode).toBe(409);expect(response.json().error).toBe('IMPORT_TRACK_UNAVAILABLE');
    expect(db.playlist.create).not.toHaveBeenCalled();
  });
  it('creates a private, ordered, deduplicated playlist exactly once on retry',async()=>{
    const selected=await selection(),payload={name:'Migrated',requestId:'00000000-0000-4000-a000-000000000001',selections:[selected,selected]};
    const first=await post('commit',payload),second=await post('commit',payload);
    expect(first.statusCode,first.body).toBe(200);expect(second.json().id).toBe(first.json().id);
    expect(first.json()).toMatchObject({trackCount:1,duplicates:1});
    expect(db.playlist.create).toHaveBeenCalledTimes(1);
    expect([...playlists.values()][0]).toMatchObject({isPublic:false,creatorId:'a',tracks:{create:[{trackId:'native',order:0}]}});
  });
  it('rejects another user, tampered selections, and tracks withdrawn after preview',async()=>{
    const selected=await selection(),payload={name:'Migrated',requestId:'00000000-0000-4000-a000-000000000001',selections:[selected]};
    expect((await post('commit',payload,'b')).statusCode).toBe(409);
    expect((await post('commit',{...payload,selections:['forged']})).statusCode).toBe(409);
    visible=false;expect((await post('commit',payload)).json().error).toBe('IMPORT_TRACK_UNAVAILABLE');
    expect(db.playlist.create).not.toHaveBeenCalled();
  });
  it('binds Spotify PKCE state to the session and keeps access tokens out of response bodies',async()=>{
    const start=await post('spotify/connect',{});
    const authorization=new URL(start.json().url),state=authorization.searchParams.get('state');
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
    const cookieHeader=start.cookies.map(c=>c.name+'='+c.value).join('; ');
    const callback=user=>app.inject({url:'/api/playlist-import/spotify/callback?code=fixture-code&state='+state,headers:{'x-fixture-user':user,cookie:cookieHeader}});
    expect((await callback('b')).statusCode).toBe(400);expect(sources.spotifyExchange).not.toHaveBeenCalled();
    const ok=await callback('a');expect(ok.statusCode).toBe(302);expect(ok.headers.location).toBe('https://example.test/library?import=spotify');
    expect(ok.body).not.toContain('server-token');
    const access=ok.cookies.find(c=>c.name==='ns_spotify_import');
    expect(access.httpOnly).toBe(true);expect(access.value).not.toContain('server-token');
  });
  async function sourcePreview(count=717,truncated=false) {
    const entries=Array.from({length:count},(_,i)=>({...entry,title:`Position ${i+1}`,sourceId:i===1?null:'1234567890123456789012',unavailable:i===1}));
    sources.load.mockResolvedValue({name:'Full source list',entries,total:count,truncated});
    const preview=await post('preview',{url:'https://open.spotify.com/playlist/1234567890123456789012'});
    expect(preview.statusCode,preview.body).toBe(200);
    const result=preview.json();
    return {mode:'source',preview:result.preview,name:result.name,requestId:'00000000-0000-4000-a000-000000000002',selections:result.entries.map(item=>item.selection)};
  }
  it('saves all 717 source positions, including repeats and unavailable entries, without catalog matching',async()=>{
    const payload=await sourcePreview();
    const saved=await post('commit',payload);
    expect(saved.statusCode,saved.body).toBe(200);expect(saved.json().trackCount).toBe(717);
    const playlist=playlists.get(saved.json().id);
    expect(playlist).toMatchObject({isPublic:false,creatorId:'a',sourceImport:{provider:'SPOTIFY',version:1}});
    expect(playlist.sourceImport.items).toHaveLength(717);
    expect(playlist.sourceImport.items[1].unavailable).toBe(true);
    expect(playlist.sourceImport.items[716].title).toBe('Position 717');
    expect(playlist.sourceImport.items[0].sourceId).toBe(playlist.sourceImport.items[716].sourceId);
    expect(db.track.findMany).not.toHaveBeenCalled();expect(db.track.findFirst).not.toHaveBeenCalled();
    expect((await post('commit',payload)).json()).toMatchObject({id:playlist.id,trackCount:717,reused:true});
    expect(db.playlist.create).toHaveBeenCalledTimes(1);
  });
  it('rejects missing, reordered, mixed-preview, expired and other-user source selections',async()=>{
    const payload=await sourcePreview(3),other=await sourcePreview(3);
    expect((await post('commit',payload,'b')).statusCode).toBe(409);
    expect((await post('commit',{...payload,selections:payload.selections.slice(1)})).statusCode).toBe(400);
    expect((await post('commit',{...payload,selections:[...payload.selections].reverse()})).statusCode).toBe(409);
    expect((await post('commit',{...payload,selections:other.selections})).statusCode).toBe(409);
    expect((await post('commit',{...payload,preview:'tampered'})).statusCode).toBe(409);
    vi.spyOn(Date,'now').mockReturnValue(Date.now()+16*60*1000);
    expect((await post('commit',payload)).json().error).toBe('IMPORT_PREVIEW_EXPIRED');
    vi.restoreAllMocks();expect(db.playlist.create).not.toHaveBeenCalled();
  });
  it('refuses to save a truncated source list',async()=>{
    const payload=await sourcePreview(1000,true);
    expect((await post('commit',payload)).json().error).toBe('IMPORT_TOO_LARGE');
    expect(db.playlist.create).not.toHaveBeenCalled();
  });
  it('resolves only the private owner’s stored track and playlist to official embeds',async()=>{
    const saved=await post('commit',await sourcePreview(3)),id=saved.json().id;
    const get=(tail,user='a')=>app.inject({url:`/api/playlist-import/source/${id}/${tail}`,headers:user?{'x-fixture-user':user}:{}});
    expect((await get('status')).json()).toEqual({enabled:true});
    expect((await get('playback/2')).json()).toMatchObject({provider:'SPOTIFY',embedUrl:'https://open.spotify.com/embed/track/1234567890123456789012',position:2,total:3,accessScope:'playlist-import'});
    expect((await get('playback/playlist')).json()).toMatchObject({embedUrl:'https://open.spotify.com/embed/playlist/1234567890123456789012',wholePlaylist:true});
    expect((await get('playback/1')).statusCode).toBe(409);
    expect((await get('playback/999')).statusCode).toBe(409);
    expect((await get('playback/-1')).statusCode).toBe(400);
    expect((await get('playback/0','b')).statusCode).toBe(404);
    expect((await get('status',null)).statusCode).toBe(401);
    playlists.get(id).isPublic=true;
    expect((await get('status')).statusCode).toBe(404);
  });
  it('remembers a listener’s YouTube choice without changing source order or exposing it to other users',async()=>{
    youtubeMatches.configured.mockReturnValue(true);
    const saved=await post('commit',await sourcePreview()),id=saved.json().id;
    const get=position=>app.inject({url:`/api/playlist-import/source/${id}/playback/${position}`,headers:{'x-fixture-user':'a'}});
    expect((await get(716)).json()).toMatchObject({playbackMode:'SOURCE_MATCH',provider:'YOUTUBE',position:716,track:{title:'Position 717'}});
    expect(youtubeMatches.search).not.toHaveBeenCalled();
    const match=await post(`source/${id}/alternatives/716`,{});
    const selection=match.json().candidates[0].selection;
    expect((await post(`source/${id}/choice/716`,{selection},'b')).statusCode).toBe(409);
    expect((await post(`source/${id}/choice/715`,{selection})).statusCode).toBe(409);
    expect((await post(`source/${id}/choice/716`,{selection:'forged'})).statusCode).toBe(409);
    expect((await post(`source/${id}/choice/716`,{selection})).json()).toEqual({saved:true});
    expect((await get(716)).json()).toMatchObject({provider:'YOUTUBE',playbackMode:'OFFICIAL_EMBED',videoId:'abcdefghijk',position:716});
    expect(playlists.get(id).sourceImport.items).toHaveLength(717);
    expect(playlists.get(id).sourceImport.items[0].youtubeId).toBeUndefined();
    expect((await post(`source/${id}/alternatives/716`,{},'b')).statusCode).toBe(404);
    playlists.get(id).isPublic=true;
    expect((await post(`source/${id}/choice/716`,{selection})).statusCode).toBe(404);
  });
  it('starts a Spotify list inside NoirSound and rejects a stale match after source metadata changes',async()=>{
    youtubeMatches.configured.mockReturnValue(true);
    const saved=await post('commit',await sourcePreview(3)),id=saved.json().id;
    const playback=await app.inject({url:`/api/playlist-import/source/${id}/playback/playlist`,headers:{'x-fixture-user':'a'}});
    expect(playback.json()).toMatchObject({playbackMode:'SOURCE_MATCH',position:0,sourceQueue:[{position:0},{position:1},{position:2}]});
    youtubeMatches.inspect.mockResolvedValue({videoId:'abcdefghijk',title:'Verified link'});
    const found=await post(`source/${id}/alternatives/1`,{url:'https://youtu.be/abcdefghijk'});
    expect(youtubeMatches.inspect).toHaveBeenCalledWith('https://youtu.be/abcdefghijk');
    const selection=found.json().candidates[0].selection;
    playlists.get(id).sourceImport.items[1].title='Changed';
    expect((await post(`source/${id}/choice/1`,{selection})).statusCode).toBe(409);
  });
});
