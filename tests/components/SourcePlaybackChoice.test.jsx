import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import SourcePlaybackChoice from '../../src/components/player/SourcePlaybackChoice';
import YouTubePlayback from '../../src/components/player/YouTubePlayback';
import {sourceAlternatives,saveSourceChoice} from '../../src/api/playlistImport';
import {usePlayerStore} from '../../src/store/playerStore';
import {loadYouTubePlayer} from '../../src/services/youtubePlayer';
vi.mock('react-i18next',()=>{const t=key=>key;return {useTranslation:()=>({t})};});
vi.mock('../../src/api/playlistImport',()=>({sourceAlternatives:vi.fn(),saveSourceChoice:vi.fn(),importedPlayback:vi.fn()}));
vi.mock('../../src/services/youtubePlayer',()=>({loadYouTubePlayer:vi.fn()}));
const track={id:'source:p:716',title:'Last track',importedPlaylistId:'p',position:716,provider:'SPOTIFY',playbackMode:'OFFICIAL_EMBED'};
const embed={playlistId:'p',position:716,track,sourceQueue:[track],generation:1};
beforeEach(()=>{vi.clearAllMocks();sourceAlternatives.mockResolvedValue({candidates:[{videoId:'abcdefghijk',title:'Artist — Last track',channel:'Artist',duration:144,selection:'signed'}]});saveSourceChoice.mockResolvedValue({saved:true});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('full-length source choice inside NoirSound',()=>{
 it('asks for a version once, saves the signed choice, then opens the same playlist position',async()=>{
  const play=vi.spyOn(usePlayerStore.getState(),'playTrack').mockResolvedValue();
  render(<SourcePlaybackChoice embed={embed}/>);
  const button=await screen.findByRole('button',{name:/Artist — Last track/});
  expect(button.textContent).toContain('2:24');
  fireEvent.click(button);
  await waitFor(()=>expect(play).toHaveBeenCalledWith(track,[track]));
  expect(saveSourceChoice).toHaveBeenCalledWith('p',716,'signed',expect.any(AbortSignal));
  expect(sourceAlternatives).toHaveBeenCalledTimes(1);
 });
 it('keeps the link option available when search quota runs out',async()=>{
  sourceAlternatives.mockRejectedValueOnce(Object.assign(new Error(),{code:'IMPORT_SEARCH_QUOTA'}));
  render(<SourcePlaybackChoice embed={embed}/>);
  await screen.findByText('playlistImport.errors.IMPORT_SEARCH_QUOTA');
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'https://youtu.be/abcdefghijk'}});
  fireEvent.click(screen.getByRole('button',{name:'playlistImport.checkVideo'}));
  await screen.findByRole('button',{name:/Artist — Last track/});
  expect(sourceAlternatives.mock.calls[1].slice(0,3)).toEqual(['p',716,{url:'https://youtu.be/abcdefghijk'}]);
 });
 it('uses a visible official player, advances only on ended, and destroys playback on unmount',async()=>{
  let options;const stopVideo=vi.fn(),destroy=vi.fn();
  loadYouTubePlayer.mockResolvedValue({Player:class{constructor(_target,opts){options=opts;}stopVideo=stopVideo;destroy=destroy;}});
  const ended=vi.fn(),view=render(<YouTubePlayback videoId="abcdefghijk" onEnded={ended}/>);
  const frame=await screen.findByTitle('YouTube');
  expect(Number(frame.height)).toBeGreaterThanOrEqual(200);expect(frame.referrerPolicy).toBe('strict-origin-when-cross-origin');
  expect(frame.src).toContain('youtube-nocookie.com/embed/abcdefghijk?');
  await act(async()=>options.events.onStateChange({data:1}));expect(ended).not.toHaveBeenCalled();
  await act(async()=>options.events.onStateChange({data:0}));expect(ended).toHaveBeenCalledOnce();
  view.unmount();expect(stopVideo).toHaveBeenCalledOnce();expect(destroy).toHaveBeenCalledOnce();expect(frame.src).toBe('about:blank');
 });
 it('does not create a late YouTube player after closing',async()=>{
  let resolve;const Player=vi.fn();loadYouTubePlayer.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const view=render(<YouTubePlayback videoId="abcdefghijk"/>);view.unmount();
  await act(async()=>resolve({Player}));expect(Player).not.toHaveBeenCalled();
 });
});
