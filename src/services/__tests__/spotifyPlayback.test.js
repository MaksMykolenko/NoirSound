import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createSpotifyController } from '../spotifyPlayback';
import { spotifyPlaybackToken, startSpotifyTrack } from '../../api/playlistImport';
vi.mock('../../api/playlistImport',()=>({spotifyPlaybackToken:vi.fn(),startSpotifyTrack:vi.fn()}));
const track={importedPlaylistId:'playlist',position:716,sourceId:'1234567890123456789012'};
const uri='spotify:track:'+track.sourceId;
let handlers, instance, controller, callbacks;
beforeEach(()=>{
  vi.useFakeTimers();handlers={};callbacks={onState:vi.fn(),onEnded:vi.fn(),onError:vi.fn()};
  instance={addListener:vi.fn((event,callback)=>{handlers[event]=callback;}),connect:vi.fn(async()=>{handlers.ready({device_id:'browser-device'});return true;}),activateElement:vi.fn(async()=>{}),getCurrentState:vi.fn(async()=>({paused:false,position:42000,duration:180000,track_window:{current_track:{uri}}})),pause:vi.fn(async()=>{}),togglePlay:vi.fn(async()=>{}),seek:vi.fn(async()=>{}),setVolume:vi.fn(async()=>{}),disconnect:vi.fn()};
  window.Spotify={Player:vi.fn(function(){return instance;})};
  spotifyPlaybackToken.mockResolvedValue({accessToken:'access',expiresAt:Date.now()+3600000});startSpotifyTrack.mockResolvedValue({playing:true});
  controller=createSpotifyController(callbacks);
});
afterEach(()=>{controller.destroy();delete window.Spotify;vi.useRealTimers();vi.clearAllMocks();});
describe('Spotify audio behind the NoirSound controls',()=>{
  it('starts the selected private position and reports full-song progress to existing controls',async()=>{
    await controller.start(track,.3);
    expect(startSpotifyTrack).toHaveBeenCalledWith('playlist',716,'browser-device',expect.any(AbortSignal));
    expect(callbacks.onState).toHaveBeenCalledWith(expect.objectContaining({progress:42,duration:180,isPlaying:true}));
    await controller.toggle();await controller.seek(75);await controller.volume(.2);
    expect(instance.togglePlay).toHaveBeenCalledOnce();expect(instance.seek).toHaveBeenCalledWith(75000);expect(instance.setVolume).toHaveBeenCalledWith(.2);
  });
  it('advances once at the end and never continues provider radio outside the NoirSound queue',async()=>{
    await controller.start(track,.3);
    handlers.player_state_changed({paused:false,position:179500,duration:180000,track_window:{current_track:{uri}}});
    handlers.player_state_changed({paused:true,position:0,duration:180000,track_window:{current_track:{uri}}});
    handlers.player_state_changed({paused:false,position:1000,duration:180000,track_window:{current_track:{uri:'spotify:track:radio'}}});
    expect(callbacks.onEnded).toHaveBeenCalledOnce();expect(instance.pause).toHaveBeenCalledOnce();
  });
  it('disconnects on a source switch and ignores late playback events',async()=>{
    await controller.start(track,.3);controller.destroy();callbacks.onState.mockClear();
    handlers.player_state_changed({paused:false,position:60000,duration:180000,track_window:{current_track:{uri}}});
    await vi.advanceTimersByTimeAsync(3000);
    expect(instance.disconnect).toHaveBeenCalledOnce();expect(callbacks.onState).not.toHaveBeenCalled();
  });
  it('does not create a Spotify device when access has not been granted',async()=>{
    spotifyPlaybackToken.mockRejectedValueOnce(new Error('SPOTIFY_PLAYBACK_CONNECT'));
    await expect(controller.start(track,.3)).rejects.toThrow('SPOTIFY_PLAYBACK_CONNECT');
    expect(window.Spotify.Player).not.toHaveBeenCalled();expect(startSpotifyTrack).not.toHaveBeenCalled();
  });
});
