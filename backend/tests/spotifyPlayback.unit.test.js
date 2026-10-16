import { describe, expect, it, vi } from 'vitest';
import spotify from '../src/providers/spotifyPlayback';
describe('Spotify playback transport',()=>{
  it('starts only the stored track on the requested browser device',async()=>{
    const fetchImpl=vi.fn(async()=>new Response(null,{status:204}));
    await spotify.createSpotifyPlayback({fetchImpl}).play('private-access','device','1234567890123456789012');
    const [url,options]=fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/me/player/play?device_id=device');
    expect(JSON.parse(options.body)).toEqual({uris:['spotify:track:1234567890123456789012']});
    expect(options.redirect).toBe('error');expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it.each([[401,'SPOTIFY_PLAYBACK_CONNECT'],[403,'SPOTIFY_PLAYBACK_PREMIUM'],[429,'SPOTIFY_PLAYBACK_RATE_LIMIT'],[500,'SPOTIFY_PLAYBACK_UNAVAILABLE']])('maps provider %i without exposing its response or token',async(status,code)=>{
    const fetchImpl=vi.fn(async()=>new Response('sensitive upstream detail',{status}));
    await expect(spotify.createSpotifyPlayback({fetchImpl}).play('secret','device','track')).rejects.toMatchObject({code});
  });
  it('retains a refresh token when Spotify does not rotate it',async()=>{
    const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({access_token:'new',expires_in:3600}),{status:200}));
    const fresh=await spotify.createSpotifyPlayback({fetchImpl,env:{SPOTIFY_CLIENT_ID:'client'}}).refresh('refresh');
    expect(fresh).toMatchObject({access:'new',refresh:'refresh'});expect(fresh.tokenExpires).toBeGreaterThan(Date.now());
    expect(fetchImpl.mock.calls[0][1].body.get('client_id')).toBe('client');
  });
});
