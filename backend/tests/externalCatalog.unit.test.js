import {describe,it,expect,vi} from 'vitest';
import catalog from '../src/lib/externalCatalog';
import provider from '../src/providers/audius';
const {platformUrl,versionFromTitle,matchAssessment,recordingView,allowRole}=catalog;
const {createAudiusAdapter}=provider;
const sample={id:'D7KyD',title:'Test fixture',permalink:'/fixture/test-fixture',duration:120,user:{name:'Fixture artist'},is_streamable:true,is_available:true,is_delete:false,is_unlisted:false,is_stream_gated:false,allowed_api_keys:[]};
const response=d=>new Response(JSON.stringify({data:d}),{headers:{'content-type':'application/json'}});
const rec=(id,version='UNKNOWN')=>({id,trackId:id,versionType:version,track:{catalogScope:'EXTERNAL_BETA',title:'Fixture title',primaryArtistName:'Fixture artist',durationSeconds:120,explicit:false},sources:[],members:[]});
describe('ordinary external track capabilities',()=>{
 it.each(['SOUNDCLOUD','APPLE_MUSIC','YOUTUBE'])('confirmed %s links use official controls without advertising a stream',provider=>{
  const a=rec('embed');a.sources=[{id:'source',provider,playbackMode:'LINK_OUT',availability:'UNKNOWN',matchStatus:'CONFIRMED',officialStatus:'UNVERIFIED'}];
  expect(recordingView(a)).toMatchObject({artistId:null,provider,selectedSourceId:'source',playbackMode:'OFFICIAL_EMBED',isAvailable:true,isStreamable:false,canSave:true});
 });
 it.each(['UNVERIFIED','REJECTED'])('a %s match cannot become playable through an ordinary card',matchStatus=>{
  const a=rec('embed');a.sources=[{provider:'YOUTUBE',playbackMode:'LINK_OUT',matchStatus,availability:'UNKNOWN'}];expect(recordingView(a).playbackMode).toBe('LINK_OUT');
 });
 it('Spotify retains its source and can be saved, without entering audio playback',()=>{
  const a=rec('spotify');a.sources=[{provider:'SPOTIFY',playbackMode:'LINK_OUT',matchStatus:'CONFIRMED'}];expect(recordingView(a)).toMatchObject({provider:'SPOTIFY',canSave:true,isAvailable:true,isStreamable:false,playbackMode:'LINK_OUT'});
 });
 it('removed publications cannot become official embeds',()=>{
  const a=rec('removed');a.sources=[{provider:'YOUTUBE',playbackMode:'LINK_OUT',matchStatus:'CONFIRMED',availability:'UNAVAILABLE'}];expect(recordingView(a).playbackMode).toBe('LINK_OUT');
 });
});
describe('external catalog URL boundaries and conservative identity',()=>{
 it.each(['https://open.spotify.com.evil.test/track/1234567890123456789012','http://open.spotify.com/track/1234567890123456789012','https://user@open.spotify.com/track/1234567890123456789012','https://127.0.0.1/track/1234567890123456789012','https://open.spotify.com:444/track/1234567890123456789012','https://open.spotify.com/album/1234567890123456789012','https://open.spotify.com/track/%2e%2e'])('rejects unsafe/nonrecording URL %s',url=>expect(()=>platformUrl('SPOTIFY',url)).toThrow());
 it('canonicalizes YouTube aliases and drops tracking without fetching',()=>expect(platformUrl('YOUTUBE','https://youtu.be/abcdefghijk?si=tracker')).toEqual(platformUrl('YOUTUBE','https://www.youtube.com/watch?v=abcdefghijk&t=30')));
 it('requires an Apple album link to identify a recording',()=>{expect(()=>platformUrl('APPLE_MUSIC','https://music.apple.com/us/album/name/123')).toThrow();expect(platformUrl('APPLE_MUSIC','https://music.apple.com/us/album/name/123?i=456').externalId).toBe('456');});
 it.each(['remix','live','nightcore','sped up','slowed','acoustic','instrumental','radio edit','clean','explicit'])('retains version marker %s',marker=>{const a=rec('a'),b=rec('b',versionFromTitle(`Fixture title (${marker})`));b.track.title+=` (${marker})`;expect(matchAssessment(a,b)).toBe('CONFLICT');});
 it('same title and duration never establishes an original or automatic merge',()=>{const a=rec('a'),b=rec('b');expect(matchAssessment(a,b)).toBe('MANUAL_REVIEW');expect(recordingView(a).versionType).toBe('UNKNOWN');});
 it('ISRC requires artist/version/duration consistency',()=>{const a=rec('a','ORIGINAL'),b=rec('b','ORIGINAL');a.isrc=b.isrc='USAAA2600001';expect(matchAssessment(a,b)).toBe('STRONG_ISRC');b.track.durationSeconds=180;expect(matchAssessment(a,b)).toBe('CONFLICT');});
 it('admin role does not follow a display name',()=>{expect(allowRole({role:'LISTENER',displayName:'Owner'})).toBe(false);expect(allowRole({id:'a',role:'ADMIN'})).toBe(true);});
 it('confirmed official source outranks a reupload and one provider gets one main link',()=>{const a=rec('a');a.sources=[{id:'reupload',provider:'YOUTUBE',officialStatus:'UNVERIFIED',matchStatus:'CONFIRMED',createdAt:new Date(0)},{id:'official',provider:'YOUTUBE',officialStatus:'VERIFIED',matchStatus:'CONFIRMED',createdAt:new Date(1)}];expect(recordingView(a).primarySources.map(x=>x.id)).toEqual(['official']);});
 it('unconfirmed publication is not playable as a matched recording',()=>{const a=rec('a');a.sources=[{provider:'AUDIUS',playbackMode:'EXTERNAL_STREAM',availability:'AVAILABLE',matchStatus:'UNVERIFIED'}];expect(recordingView(a).isStreamable).toBe(false);});
 it('expired metadata cannot be advertised as available',()=>{const a=rec('a');a.metadataExpiresAt=new Date(0);expect(recordingView(a).isStreamable).toBe(false);expect(recordingView(a).coverUrl).toBeNull();});
});
describe('Audius official adapter',()=>{
 it('uses the fixed official public origin without invented credentials',async()=>{const f=vi.fn(async()=>response([sample]));const a=createAudiusAdapter({fetchImpl:f,env:{}});expect((await a.search('fixture'))[0].availability).toBe('AVAILABLE');expect(f.mock.calls[0][0].origin).toBe('https://api.audius.co');expect(f.mock.calls[0][1].headers).toEqual({});expect(a.status()).toBe('LIVE');});
 it.each([{is_stream_gated:true},{is_unlisted:true},{is_delete:true},{is_available:false},{allowed_api_keys:['restricted']},{stream_conditions:{purchase:{}}}])('does not bypass gated/private/deleted constraints %j',async extra=>{const a=createAudiusAdapter({fetchImpl:async()=>response({...sample,...extra}),env:{}});await expect(a.playback(sample.id)).rejects.toMatchObject({code:'EXTERNAL_TRACK_UNAVAILABLE'});});
 it.each([401,403,404,429])('does not retry HTTP %i',async status=>{const f=vi.fn(async()=>new Response('',{status}));const a=createAudiusAdapter({fetchImpl:f,env:{}});await expect(a.search('fixture')).rejects.toMatchObject({code:`AUDIUS_HTTP_${status}`});expect(f).toHaveBeenCalledTimes(1);});
 it('limits retries on upstream failure',async()=>{const f=vi.fn(async()=>new Response('',{status:503}));const a=createAudiusAdapter({fetchImpl:f,env:{}});await expect(a.search('fixture')).rejects.toMatchObject({code:'AUDIUS_HTTP_503'});expect(f).toHaveBeenCalledTimes(2);});
 it('rejects an off-origin resolve redirect without fetching it',async()=>{const f=vi.fn(async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/v1/tracks/D7KyD'}}));const a=createAudiusAdapter({fetchImpl:f,env:{}});await expect(a.resolve('https://audius.co/fixture/test-fixture')).rejects.toMatchObject({code:'AUDIUS_RESOLVE_INVALID'});expect(f).toHaveBeenCalledTimes(1);});
 it('uses the exact signed audio CID through the fixed gateway without fetching a node URL',async()=>{const cid='Qmabcdefghijklmnopqrstuvwxyz1234567890';const f=vi.fn(async(url)=>{if(url.pathname.endsWith('/stream'))return new Response(null,{status:302,headers:{location:`https://node.example/tracks/cidstream/${cid}?signature=public-fixture-signature`}});if(url.hostname==='creatornode.audius.co')return new Response(null,{status:200});return response({...sample,track_cid:cid});});const a=createAudiusAdapter({fetchImpl:f,env:{}});const p=await a.playback(sample.id);expect(new URL(p.url).hostname).toBe('creatornode.audius.co');expect(f.mock.calls.map(([u])=>u.hostname)).toEqual(['api.audius.co','api.audius.co','creatornode.audius.co']);});
 it('disabled provider does not call the network',async()=>{const f=vi.fn();const a=createAudiusAdapter({fetchImpl:f,env:{AUDIUS_ENABLED:'false'}});await expect(a.search('fixture')).rejects.toMatchObject({code:'AUDIUS_DISABLED'});expect(f).not.toHaveBeenCalled();});
});

describe('public beta protects native visibility',()=>{
 it('does not expose private native recordings or moderation evidence',()=>{const r=rec('private');r.track.catalogScope='NATIVE';r.track.processedAudioKey='fixture';r.track.status='PUBLISHED';r.track.isPublic=false;expect(catalog.visibleRecording(r)).toBe(false);r.track.isPublic=true;expect(catalog.visibleRecording(r)).toBe(true);r.sources=[{id:'a',provider:'AUDIUS',verificationEvidence:'private moderation evidence',provenance:'private operator note'}];expect(recordingView(r).sources[0]).not.toHaveProperty('verificationEvidence');expect(recordingView(r).sources[0]).not.toHaveProperty('provenance');});
});
