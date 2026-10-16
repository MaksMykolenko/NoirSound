const sdk = vi.hoisted(()=>({controllers:[],callbacks:[]}));
vi.mock('../../services/spotifyPlayback',()=>({createSpotifyController:vi.fn(callbacks=>{const controller={start:vi.fn(async(_track,_volume,nextCallbacks)=>{controller.callbacks=nextCallbacks;}),suspend:vi.fn(),destroy:vi.fn(),toggle:vi.fn(async()=>{}),pause:vi.fn(async()=>{}),seek:vi.fn(async()=>{}),volume:vi.fn(async()=>{})};sdk.controllers.push(controller);sdk.callbacks.push(callbacks);return controller;})}));
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import connectPresenceService from '../../services/noirsoundConnect';
import {useUserStore} from '../userStore';
import {usePlayerStore,__getAudioElementForTests} from '../playerStore';
const native={id:'native',title:'Native fixture',artistId:'artist',isStreamable:true,duration:180};
const external={id:'external',title:'Audius fixture',recordingId:'record',selectedSourceId:'source',playbackMode:'EXTERNAL_STREAM',playbackSource:'external',isStreamable:true,duration:180};
const res=data=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>data});
describe('one global player across providers',()=>{
 beforeEach(()=>{sdk.controllers.length=0;sdk.callbacks.length=0;useUserStore.setState({user:null});vi.spyOn(window.HTMLMediaElement.prototype,'play').mockResolvedValue();vi.spyOn(window.HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});usePlayerStore.getState().pause();usePlayerStore.setState({currentTrack:null,isPlaying:false,queue:[],recentlyPlayed:[],playbackError:null});});
 afterEach(()=>{usePlayerStore.getState().pause();vi.restoreAllMocks();vi.unstubAllGlobals();});
 it('runs native -> Audius -> native on the same Audio element',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>res({url:'https://creatornode.audius.co/tracks/cidstream/fixture',playbackMode:'EXTERNAL_STREAM'})));await usePlayerStore.getState().playTrack(native);const audio=__getAudioElementForTests();await usePlayerStore.getState().playTrack(external);expect(__getAudioElementForTests()).toBe(audio);expect(audio.src).toContain('creatornode.audius.co');await usePlayerStore.getState().playTrack(native);expect(audio.src).toContain('/tracks/native/stream');expect(usePlayerStore.getState().currentTrack.id).toBe('native');});
 it('discards a stale external resolution after switching to native',async()=>{let resolve;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));const first=usePlayerStore.getState().playTrack(external);await usePlayerStore.getState().playTrack(native);resolve(res({url:'https://creatornode.audius.co/old',playbackMode:'EXTERNAL_STREAM'}));await first;expect(__getAudioElementForTests().src).toContain('/tracks/native/stream');expect(usePlayerStore.getState().currentTrack.id).toBe('native');});
 it('pause cancels a pending resolver without starting audio',async()=>{let resolve;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));const request=usePlayerStore.getState().playTrack(external);usePlayerStore.getState().pause();resolve(res({url:'https://creatornode.audius.co/old',playbackMode:'EXTERNAL_STREAM'}));await request;expect(usePlayerStore.getState().isPlaying).toBe(false);expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();});
 it('LINK_OUT cannot play or queue or open a website',async()=>{const open=vi.spyOn(window,'open');const link={...external,playbackMode:'LINK_OUT'};usePlayerStore.getState().addToQueue(link);await usePlayerStore.getState().playTrack(link);expect(usePlayerStore.getState().queue).toEqual([]);expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();});
 it('external qualifying playback posts separate events, never native stats',async()=>{useUserStore.setState({user:{id:'listener',role:'LISTENER'}});const f=vi.fn(async url=>res(String(url).includes('/play-event')?{success:true}:{url:'https://creatornode.audius.co/tracks/cidstream/fixture',playbackMode:'EXTERNAL_STREAM'}));vi.stubGlobal('fetch',f);await usePlayerStore.getState().playTrack(external);const audio=__getAudioElementForTests();audio.currentTime=31;audio.dispatchEvent(new Event('timeupdate'));await new Promise(r=>setTimeout(r,0));const paths=f.mock.calls.map(([u])=>new URL(u).pathname);expect(paths).toContain('/api/external-catalog/recordings/record/play-event');expect(paths).not.toContain('/api/tracks/external/play-event');});
 it('automatically saves a live card before playing its actual stored identity',async()=>{
  useUserStore.setState({user:{id:'admin',role:'ADMIN'}});
  const preview={...external,id:'AUDIUS:owned',recordingId:undefined,selectedSourceId:undefined,provider:'AUDIUS',previewExternalId:'owned'};
  const f=vi.fn(async url=>res(String(url).endsWith('/import')?{recording:external}:{url:'https://creatornode.audius.co/tracks/cidstream/fixture',playbackMode:'EXTERNAL_STREAM'}));vi.stubGlobal('fetch',f);
  await usePlayerStore.getState().playTrack(preview,[preview]);expect(usePlayerStore.getState().currentTrack.id).toBe(external.id);expect(usePlayerStore.getState().queue[0].id).toBe(external.id);expect(f.mock.calls[0][1].body).toContain('owned');
 });
 it('a delayed automatic import cannot restart music after the user switches to native',async()=>{
  useUserStore.setState({user:{id:'admin',role:'ADMIN'}});let complete;
  vi.stubGlobal('fetch',vi.fn(url=>String(url).endsWith('/import')?new Promise(r=>{complete=r;}):Promise.resolve(res({}))));
  const request=usePlayerStore.getState().playTrack({...external,id:'AUDIUS:owned',recordingId:undefined,provider:'AUDIUS',previewExternalId:'owned'});
  await usePlayerStore.getState().playTrack(native);complete(res({recording:external}));await request;expect(usePlayerStore.getState().currentTrack.id).toBe(native.id);expect(__getAudioElementForTests().src).toContain('/tracks/native/stream');
 });
 it('replaces a queued preview identity when playback reaches it, so Next advances correctly',async()=>{
  useUserStore.setState({user:{id:'admin',role:'ADMIN'}});
  const preview={...external,id:'AUDIUS:queued',recordingId:undefined,provider:'AUDIUS',previewExternalId:'queued'};
  usePlayerStore.setState({queue:[native,preview],originalQueue:[native,preview],currentTrack:native,queueSource:'external-catalog'});
  vi.stubGlobal('fetch',vi.fn(async url=>res(String(url).endsWith('/import')?{recording:external}:{url:'https://creatornode.audius.co/tracks/cidstream/fixture',playbackMode:'EXTERNAL_STREAM'})));
  await usePlayerStore.getState().playTrack(preview);
  expect(usePlayerStore.getState().queue.map(t=>t.id)).toEqual([native.id,external.id]);expect(usePlayerStore.getState().originalQueue.map(t=>t.id)).toEqual([native.id,external.id]);expect(usePlayerStore.getState().queueSource).toBe('external-catalog');
 });
 it('a guest plays a live Audius card without importing or sending authenticated events',async()=>{
  const preview={...external,id:'AUDIUS:guest',recordingId:undefined,selectedSourceId:undefined,provider:'AUDIUS',previewExternalId:'guest'};const f=vi.fn(async()=>res({url:'https://creatornode.audius.co/tracks/cidstream/fixture',playbackMode:'EXTERNAL_STREAM'}));vi.stubGlobal('fetch',f);await usePlayerStore.getState().playTrack(preview,[preview]);expect(usePlayerStore.getState().isPlaying).toBe(true);expect(String(f.mock.calls[0][0])).toContain('/preview/guest/playback');expect(f.mock.calls.some(([u])=>String(u).includes('/import'))).toBe(false);const audio=__getAudioElementForTests();audio.currentTime=31;audio.dispatchEvent(new Event('timeupdate'));await new Promise(r=>setTimeout(r,0));expect(f.mock.calls.some(([u])=>String(u).includes('/play-event'))).toBe(false);
 });
 it('resolver failure can be followed by working native playback',async()=>{vi.spyOn(console,'error').mockImplementation(()=>{});vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:502,json:async()=>({error:'AUDIUS_UNAVAILABLE'})})));await usePlayerStore.getState().playTrack(external);expect(usePlayerStore.getState().isPlaying).toBe(false);await usePlayerStore.getState().playTrack(native);expect(usePlayerStore.getState().isPlaying).toBe(true);expect(usePlayerStore.getState().playbackError).toBeNull();});
 it('uses the existing controls for Spotify and preserves repeated source positions',async()=>{
  useUserStore.setState({user:{id:'listener'}});
  const track={id:'source:p:0',sourceId:'1234567890123456789012',importedPlaylistId:'p',position:0,title:'Source',provider:'SPOTIFY',playbackMode:'IMPORTED_SOURCE',isStreamable:false};
  const queue=[track,{...track,id:'source:p:1',position:1}];
  vi.stubGlobal('fetch',vi.fn(async url=>res({playbackMode:'SPOTIFY_SDK',track:queue[String(url).endsWith('/1')?1:0]})));
  await usePlayerStore.getState().playTrack(native);
  await usePlayerStore.getState().playTrack(track,queue);
  expect(connectPresenceService.currentTrackId).toBeNull();
  expect(usePlayerStore.getState().activePlatformEmbed).toBeNull();
  expect(usePlayerStore.getState().queue).toEqual(queue);
  expect(__getAudioElementForTests().getAttribute('src')).toBeNull();
  sdk.callbacks[0].onState({isPlaying:true,progress:42,duration:180});
  expect(usePlayerStore.getState()).toMatchObject({isPlaying:true,progress:42,duration:180,playbackLoading:false});
  usePlayerStore.getState().togglePlay();usePlayerStore.getState().seek(70);usePlayerStore.getState().setVolume(.3);
  expect(sdk.controllers[0].toggle).toHaveBeenCalledOnce();expect(sdk.controllers[0].seek).toHaveBeenCalledWith(70);expect(sdk.controllers[0].volume).toHaveBeenCalledWith(.3);
  usePlayerStore.getState().next();await vi.waitFor(()=>expect(sdk.controllers[0].start).toHaveBeenCalledTimes(2));
  expect(sdk.controllers).toHaveLength(1);expect(sdk.controllers[0].destroy).not.toHaveBeenCalled();expect(sdk.controllers[0].suspend).toHaveBeenCalled();expect(usePlayerStore.getState().currentTrack.id).toBe('source:p:1');
  useUserStore.setState({user:null});expect(sdk.controllers[0].destroy).toHaveBeenCalled();
  sdk.controllers[0].callbacks.onState({isPlaying:true,progress:50,duration:180});expect(usePlayerStore.getState().currentTrack).toBeNull();
 });
 it('an imported resolution cannot override native playback after switching tracks',async()=>{
  let resolve;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));
  const track={id:'source:p:0',importedPlaylistId:'p',position:0,playbackMode:'IMPORTED_SOURCE'};
  const pending=usePlayerStore.getState().playTrack(track);
  await usePlayerStore.getState().playTrack(native);
  resolve(res({playbackMode:'SPOTIFY_SDK',track:{...track,provider:'SPOTIFY'}}));await pending;
  expect(sdk.controllers).toHaveLength(0);expect(usePlayerStore.getState().currentTrack.id).toBe('native');
 });
 it('obsolete widget cards show an availability error without opening frames or websites',async()=>{
  const open=vi.spyOn(window,'open');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await usePlayerStore.getState().playTrack({...native,playbackMode:'OFFICIAL_EMBED',isStreamable:false});
  expect(fetch).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();expect(usePlayerStore.getState()).toMatchObject({activePlatformEmbed:null,isPlaying:false,playbackError:'IMPORT_AUDIO_UNAVAILABLE'});
 });

});
