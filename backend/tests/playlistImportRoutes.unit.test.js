import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import routes from '../src/routes/playlistImport';

describe('playlist import authorization and confirmation',()=>{
  let app,db,playlists,visible,sources;
  const entry={title:'Fixture',artist:'Artist',duration:180};
  const post=(path,payload,user='a')=>app.inject({method:'POST',url:'/api/playlist-import/'+path,headers:user?{'x-fixture-user':user}:{},payload});
  beforeEach(async()=>{
    visible=true;playlists=new Map();vi.stubEnv('EXTERNAL_CATALOG_PUBLIC','false');
    db={
      track:{findMany:vi.fn(async()=>[{id:'native',title:'Fixture',primaryArtistName:'Artist',durationSeconds:180}]),findFirst:vi.fn(async()=>visible?{id:'native'}:null)},
      playlist:{findUnique:vi.fn(async({where})=>playlists.get(where.id)),create:vi.fn(async({data})=>{playlists.set(data.id,{...data,_count:{tracks:data.tracks.create.length}});return data;})},
      auditLog:{create:vi.fn(async()=>{})},$executeRaw:vi.fn(async()=>{}),
      $transaction:async fn=>fn(db),
    };
    sources={capabilities:()=>({SPOTIFY:true,YOUTUBE:false,SOUNDCLOUD:false}),spotifyExchange:vi.fn(async()=>({access:'server-token',expires:Date.now()+900000}))};
    app=Fastify();app.decorate('prisma',db);app.decorate('authenticate',async(request,reply)=>{
      if(!request.headers['x-fixture-user'])return reply.code(401).send({error:'Unauthorized'});
      request.user={id:request.headers['x-fixture-user'],role:'LISTENER'};request.sessionId='session-'+request.user.id;
    });
    await app.register(cookie);
    await app.register(routes,{prefix:'/api/playlist-import',sources,env:{COOKIE_SECRET:'test-only',SPOTIFY_CLIENT_ID:'fixture',SPOTIFY_REDIRECT_URI:'https://example.test/api/playlist-import/spotify/callback',FRONTEND_ORIGIN:'https://example.test'}});
    await app.ready();
  });
  afterEach(async()=>{await app.close();vi.unstubAllEnvs();});
  async function selection(){
    const response=await post('matches',{entries:[entry]});expect(response.statusCode,response.body).toBe(200);
    expect(db.track.findMany.mock.calls[0][0].where).toMatchObject({isPublic:true,catalogScope:'NATIVE',status:'PUBLISHED',artist:{isHidden:false,user:{status:'ACTIVE'}}});
    return response.json().results[0].candidates[0].selection;
  }
  it('requires a session even for previews',async()=>{
    expect((await post('preview',{fileText:'Artist - Fixture'},null)).statusCode).toBe(401);
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
});
