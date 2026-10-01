import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {useUserStore} from '../userStore';
import {usePlayerStore,__getAudioElementForTests,registerPlatformFrameStop} from '../playerStore';
const native={id:'native',title:'Native fixture',artistId:'artist',isStreamable:true,duration:180};
const external={id:'external',title:'Audius fixture',recordingId:'record',selectedSourceId:'source',playbackMode:'EXTERNAL_STREAM',playbackSource:'external',isStreamable:true,duration:180};
const res=data=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>data});
describe('one global player across providers',()=>{
 beforeEach(()=>{useUserStore.setState({user:null});vi.spyOn(window.HTMLMediaElement.prototype,'play').mockResolvedValue();vi.spyOn(window.HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});usePlayerStore.getState().pause();usePlayerStore.setState({currentTrack:null,isPlaying:false,queue:[],recentlyPlayed:[],playbackError:null});});
 afterEach(()=>{usePlayerStore.getState().pause();vi.restoreAllMocks();vi.unstubAllGlobals();});
 it('runs native -> Audius -> native on the same Audio element',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>res({url:'https://creatornode.audius.co/tracks/cidstream/fixture',playbackMode:'EXTERNAL_STREAM'})));await usePlayerStore.getState().playTrack(native);const audio=__getAudioElementForTests();await usePlayerStore.getState().playTrack(external);expect(__getAudioElementForTests()).toBe(audio);expect(audio.src).toContain('creatornode.audius.co');await usePlayerStore.getState().playTrack(native);expect(audio.src).toContain('/tracks/native/stream');expect(usePlayerStore.getState().currentTrack.id).toBe('native');});
 it('discards a stale external resolution after switching to native',async()=>{let resolve;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));const first=usePlayerStore.getState().playTrack(external);await usePlayerStore.getState().playTrack(native);resolve(res({url:'https://creatornode.audius.co/old',playbackMode:'EXTERNAL_STREAM'}));await first;expect(__getAudioElementForTests().src).toContain('/tracks/native/stream');expect(usePlayerStore.getState().currentTrack.id).toBe('native');});
 it('pause cancels a pending resolver without starting audio',async()=>{let resolve;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));const request=usePlayerStore.getState().playTrack(external);usePlayerStore.getState().pause();resolve(res({url:'https://creatornode.audius.co/old',playbackMode:'EXTERNAL_STREAM'}));await request;expect(usePlayerStore.getState().isPlaying).toBe(false);expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();});
 it('LINK_OUT cannot play or queue or open a website',async()=>{const open=vi.spyOn(window,'open');const link={...external,playbackMode:'LINK_OUT'};usePlayerStore.getState().addToQueue(link);await usePlayerStore.getState().playTrack(link);expect(usePlayerStore.getState().queue).toEqual([]);expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();});
 it('external qualifying playback posts separate events, never native stats',async()=>{const f=vi.fn(async url=>res(String(url).includes('/play-event')?{success:true}:{url:'https://creatornode.audius.co/tracks/cidstream/fixture',playbackMode:'EXTERNAL_STREAM'}));vi.stubGlobal('fetch',f);await usePlayerStore.getState().playTrack(external);const audio=__getAudioElementForTests();audio.currentTime=31;audio.dispatchEvent(new Event('timeupdate'));await new Promise(r=>setTimeout(r,0));const paths=f.mock.calls.map(([u])=>new URL(u).pathname);expect(paths).toContain('/api/external-catalog/recordings/record/play-event');expect(paths).not.toContain('/api/tracks/external/play-event');});
 it('official frame -> native destroys the frame before audio starts; iframe plays never enter queue/stats',async()=>{
  useUserStore.setState({user:{id:'admin',role:'ADMIN'}});
  vi.stubGlobal('fetch',vi.fn(async()=>res({provider:'YOUTUBE',playbackMode:'OFFICIAL_EMBED',embedUrl:'https://www.youtube-nocookie.com/embed/abcdefghijk',canonicalUrl:'https://www.youtube.com/watch?v=abcdefghijk'})));
  await usePlayerStore.getState().playTrack(native,[native]);
  await usePlayerStore.getState().openPlatformEmbed('YOUTUBE','https://youtu.be/abcdefghijk');
  expect(__getAudioElementForTests().getAttribute('src')).toBeNull();expect(usePlayerStore.getState().isPlaying).toBe(false);expect(usePlayerStore.getState().queue).toEqual([native]);
  const stop=vi.fn();const unregister=registerPlatformFrameStop(stop);
  const calls=window.HTMLMediaElement.prototype.play.mock.calls.length;
  usePlayerStore.getState().togglePlay();expect(window.HTMLMediaElement.prototype.play.mock.calls.length).toBe(calls);
  await usePlayerStore.getState().playTrack(native);
  expect(stop).toHaveBeenCalledOnce();expect(stop.mock.invocationCallOrder[0]).toBeLessThan(window.HTMLMediaElement.prototype.play.mock.invocationCallOrder.at(-1));expect(usePlayerStore.getState().activePlatformEmbed).toBeNull();unregister();
 });
 it('stale frame resolution cannot override native playback or a logged-out account',async()=>{
  useUserStore.setState({user:{id:'admin',role:'ADMIN'}});
  let resolve;vi.stubGlobal('fetch',vi.fn(url=>String(url).includes('/embed?')?new Promise(r=>{resolve=r;}):Promise.resolve(res({}))));
  const request=usePlayerStore.getState().openPlatformEmbed('YOUTUBE','https://youtu.be/abcdefghijk');
  await usePlayerStore.getState().playTrack(native);
  resolve(res({provider:'YOUTUBE',playbackMode:'OFFICIAL_EMBED',embedUrl:'https://www.youtube-nocookie.com/embed/abcdefghijk'}));await request;
  expect(usePlayerStore.getState().currentTrack.id).toBe('native');expect(usePlayerStore.getState().activePlatformEmbed).toBeNull();
  const logout=usePlayerStore.getState().openPlatformEmbed('YOUTUBE','https://youtu.be/abcdefghijk');useUserStore.setState({user:null});resolve(res({provider:'YOUTUBE',playbackMode:'OFFICIAL_EMBED',embedUrl:'https://www.youtube-nocookie.com/embed/abcdefghijk'}));await logout;expect(usePlayerStore.getState().activePlatformEmbed).toBeNull();
 });
 it('closing a frame cancels pending resolution and unsafe response origins are rejected',async()=>{
  useUserStore.setState({user:{id:'admin',role:'ADMIN'}});
  let resolve;vi.stubGlobal('fetch',vi.fn(url=>String(url).includes('/embed?')?new Promise(r=>{resolve=r;}):Promise.resolve(res({}))));
  const request=usePlayerStore.getState().openPlatformEmbed('YOUTUBE','https://youtu.be/abcdefghijk');usePlayerStore.getState().closePlatformEmbed();resolve(res({provider:'YOUTUBE',playbackMode:'OFFICIAL_EMBED',embedUrl:'https://www.youtube-nocookie.com/embed/abcdefghijk'}));await request;expect(usePlayerStore.getState().activePlatformEmbed).toBeNull();
  vi.stubGlobal('fetch',vi.fn(async()=>res({provider:'YOUTUBE',playbackMode:'OFFICIAL_EMBED',embedUrl:'https://evil.example/embed/abcdefghijk'})));
  await expect(usePlayerStore.getState().openPlatformEmbed('YOUTUBE','https://youtu.be/abcdefghijk')).rejects.toThrow('EXTERNAL_EMBED_UNSUPPORTED');
 });
 it('resolver failure can be followed by working native playback',async()=>{vi.spyOn(console,'error').mockImplementation(()=>{});vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:502,json:async()=>({error:'AUDIUS_UNAVAILABLE'})})));await usePlayerStore.getState().playTrack(external);expect(usePlayerStore.getState().isPlaying).toBe(false);await usePlayerStore.getState().playTrack(native);expect(usePlayerStore.getState().isPlaying).toBe(true);expect(usePlayerStore.getState().playbackError).toBeNull();});
});
