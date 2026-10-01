import {describe,it,expect,vi} from 'vitest';
import providers from '../src/providers/catalogs';
const {createCatalogAdapters,createCatalogFeed}=providers;
const res=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const song={id:'123456',type:'songs',attributes:{name:'Owned fixture (Live)',artistName:'Fixture artist',durationInMillis:123000,url:'https://music.apple.com/us/album/fixture/345678?i=123456',isrc:'USAAA2600001',artwork:{url:'https://is1-ssl.mzstatic.com/image/thumb/fixture/{w}x{h}bb.jpg'}}};
const video={id:'abcdefghijk',snippet:{title:'Owned fixture (Remix)',channelTitle:'Fixture uploader',categoryId:'10'},contentDetails:{duration:'PT3M12S'},status:{privacyStatus:'public',embeddable:true}};
describe('official catalog connectors and independent provider failure',()=>{
 it('missing credentials do not call APIs or manufacture live results',async()=>{
  const fetch=vi.fn(),adapters=createCatalogAdapters({fetchImpl:fetch,env:{}}),feed=createCatalogFeed(adapters);
  const result=await feed.browse('fixture');expect(result.items).toEqual([]);expect(fetch).not.toHaveBeenCalled();
  expect(result.providers.find(p=>p.provider==='APPLE_MUSIC').status).toBe('NOT_CONFIGURED');expect(result.providers.find(p=>p.provider==='SPOTIFY')).toMatchObject({status:'PERMISSION_REQUIRED',capabilities:{search:false}});
 });
 it('Apple search uses an official server-only token and keeps recording versions and real song identities',async()=>{
  const fetch=vi.fn(async()=>res({results:{songs:{data:[song],next:'/v1/catalog/us/search?offset=20'}}}));const a=createCatalogAdapters({fetchImpl:fetch,env:{APPLE_MUSIC_DEVELOPER_TOKEN:'owned-test-token'}}).APPLE_MUSIC;
  const result=await a.browse('fixture',0,20);expect(result.items[0]).toMatchObject({externalId:song.id,versionType:'LIVE',durationSeconds:123,canonicalUrl:'https://music.apple.com/us/song/123456',officialStatus:'UNVERIFIED',playbackMode:'OFFICIAL_EMBED'});expect(result.next).toBe(20);
  const [url,options]=fetch.mock.calls[0];expect(url.origin).toBe('https://api.music.apple.com');expect(url.searchParams.get('types')).toBe('songs');expect(url.href).not.toContain('owned-test-token');expect(options.headers.Authorization).toBe('Bearer owned-test-token');expect(options.redirect).toBe('manual');
 });
 it('YouTube search checks fresh video status and duration, without guessing an artist or requesting audio',async()=>{
  const f=vi.fn(async u=>res(u.pathname.endsWith('/search')?{items:[{id:{videoId:video.id}}],nextPageToken:'owned-page-token'}:{items:[video]}));const a=createCatalogAdapters({fetchImpl:f,env:{YOUTUBE_API_KEY:'owned-test-key'}}).YOUTUBE;
  const result=await a.browse('fixture');expect(result.items[0]).toMatchObject({artistName:'Fixture uploader',artistLabelKind:'UPLOADER',durationSeconds:192,versionType:'REMIX',canonicalUrl:'https://www.youtube.com/watch?v=abcdefghijk'});expect(result.next).toBe('owned-page-token');
  for(const [url,opts] of f.mock.calls){expect(url.origin).toBe('https://www.googleapis.com');expect(url.href).not.toContain('owned-test-key');expect(opts.headers['X-Goog-Api-Key']).toBe('owned-test-key');}
  expect(f.mock.calls[0][0].searchParams.get('videoEmbeddable')).toBe('true');expect(f).toHaveBeenCalledTimes(2);
 });
 it.each([{status:{privacyStatus:'private',embeddable:true}},{status:{privacyStatus:'public',embeddable:false}},{snippet:{...video.snippet,categoryId:'20'}}])('rejects nonpublic, nonembeddable and nonmusic videos %j',async extra=>{
  const a=createCatalogAdapters({fetchImpl:async()=>res({items:[{...video,...extra}]}),env:{YOUTUBE_API_KEY:'owned-test-key'}}).YOUTUBE;await expect(a.getTrack(video.id)).rejects.toMatchObject({code:'EXTERNAL_TRACK_UNAVAILABLE'});
 });
 it.each([401,403,404,429,302])('never follows redirects or retries a provider HTTP %i',async status=>{
  const f=vi.fn(async()=>new Response(null,{status,headers:{location:'https://127.0.0.1/private'}}));const a=createCatalogAdapters({fetchImpl:f,env:{APPLE_MUSIC_DEVELOPER_TOKEN:'owned-test-token'}}).APPLE_MUSIC;await expect(a.getTrack(song.id)).rejects.toMatchObject({code:`APPLE_MUSIC_HTTP_${status}`});expect(f).toHaveBeenCalledTimes(1);
 });
 it('interleaves available catalogs and isolates quota failures, with query-bound pagination',async()=>{
  const a={status:()=> 'LIVE',capabilities:{search:true},browse:vi.fn(async(q,offset)=>({items:[{provider:'AUDIUS',externalId:`item${offset}`}],next:offset===0?20:null}))};
  const b={status:()=> 'CONFIGURED',browse:async()=>{throw Object.assign(new Error(),{code:'quota'});}};
  const feed=createCatalogFeed({AUDIUS:a,YOUTUBE:b});const first=await feed.browse('fixture');expect(first.items).toHaveLength(1);expect(first.providers.find(p=>p.provider==='YOUTUBE').status).toBe('ERROR');expect(first.pageInfo.hasNextPage).toBe(true);
  const second=await feed.browse('fixture',first.pageInfo.nextCursor);expect(second.items[0].externalId).toBe('item20');expect(second.pageInfo.nextCursor).toBeNull();await expect(feed.browse('different',first.pageInfo.nextCursor)).rejects.toMatchObject({code:'EXTERNAL_CURSOR_INVALID'});
 });
 it('an unprobed public Audius adapter is browsable without an API key',async()=>{
  const feed=createCatalogFeed({AUDIUS:{status:()=> 'NOT_CONFIGURED',browse:async()=>({items:[{externalId:'owned'}],next:null})}});expect((await feed.browse()).items).toHaveLength(1);
 });
});
