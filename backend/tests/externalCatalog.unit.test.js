import {describe,it,expect} from 'vitest';
import catalog from '../src/lib/externalCatalog';
const {platformUrl,versionFromTitle,matchAssessment,recordingView,allowRole}=catalog;
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
 it('unconfirmed publication is not playable as a matched recording',()=>{const a=rec('a');a.sources=[{provider:'YOUTUBE',playbackMode:'LINK_OUT',availability:'AVAILABLE',matchStatus:'UNVERIFIED'}];expect(recordingView(a).isStreamable).toBe(false);});
 it('expired metadata cannot be advertised as available',()=>{const a=rec('a');a.metadataExpiresAt=new Date(0);expect(recordingView(a).isStreamable).toBe(false);expect(recordingView(a).coverUrl).toBeNull();});
});
describe('Audius removal',()=>{
 it('rejects Audius links as an unknown platform',()=>{expect(()=>platformUrl('AUDIUS','https://audius.co/fixture/track')).toThrow();});
 it('a legacy direct-stream source is never advertised as playable audio',()=>{const a=rec('a');a.sources=[{provider:'AUDIUS',playbackMode:'EXTERNAL_STREAM',availability:'AVAILABLE',matchStatus:'CONFIRMED'}];expect(recordingView(a)).toMatchObject({isStreamable:false,playbackMode:'LINK_OUT'});});
});

describe('public beta protects native visibility',()=>{
 it('does not expose private native recordings or moderation evidence',()=>{const r=rec('private');r.track.catalogScope='NATIVE';r.track.processedAudioKey='fixture';r.track.status='PUBLISHED';r.track.isPublic=false;expect(catalog.visibleRecording(r)).toBe(false);r.track.isPublic=true;expect(catalog.visibleRecording(r)).toBe(true);r.sources=[{id:'a',provider:'AUDIUS',verificationEvidence:'private moderation evidence',provenance:'private operator note'}];expect(recordingView(r).sources[0]).not.toHaveProperty('verificationEvidence');expect(recordingView(r).sources[0]).not.toHaveProperty('provenance');});
});
