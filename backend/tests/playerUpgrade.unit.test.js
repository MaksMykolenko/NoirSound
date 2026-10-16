import { afterEach, describe, expect, it, vi } from 'vitest';
import importing from '../src/lib/playlistImport';
import tokenModule from '../src/lib/importTokens';
import lyricsModule from '../src/providers/lyrics';
import sourceModule from '../src/providers/playlistSources';
const {playlistLink,rankCandidates}=importing;
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
afterEach(()=>vi.useRealTimers());

describe('playlist metadata parsing and matching',()=>{
  it.each(['http://open.spotify.com/playlist/1234567890123456789012','https://open.spotify.com.evil.test/playlist/1234567890123456789012','https://user@youtube.com/playlist?list=PLabcdefghijk','https://127.0.0.1/playlist?list=PLabcdefghijk','https://soundcloud.com/user/song'])('rejects unsafe/nonplaylist links %s',url=>expect(()=>playlistLink(url)).toThrow());
  it('accepts localized Spotify and YouTube Music links without fetching submitted origins',()=>{
    expect(playlistLink('https://open.spotify.com/intl-uk/playlist/1234567890123456789012?si=test')).toEqual({provider:'SPOTIFY',id:'1234567890123456789012'});
    expect(playlistLink('https://music.youtube.com/playlist?list=PLabcdefghijk').provider).toBe('YOUTUBE');
  });
  it('never automatically substitutes versions, uncertain uploaders, or ambiguous exact matches',()=>{
    const entry={title:'A song',artist:'Artist',duration:180},candidate={key:'one',title:'A song',artistName:'Artist',duration:180};
    expect(rankCandidates(entry,[candidate]).selected).toBe('one');
    expect(rankCandidates(entry,[candidate,{...candidate,key:'two'}]).selected).toBeNull();
    expect(rankCandidates({...entry,needsReview:true},[candidate]).selected).toBeNull();
    expect(rankCandidates(entry,[{...candidate,title:'A song (live)'}]).candidates).toHaveLength(0);
    expect(rankCandidates({...entry,duration:null},[candidate]).selected).toBeNull();
  });
});
describe('preview and OAuth encryption',()=>{
  it('rejects tampering, purpose confusion and expired snapshots',()=>{
    vi.useFakeTimers();const tokens=tokenModule.createImportTokens('fixture-secret');
    const sealed=tokens.seal({user:'a'},'selection',1000);
    expect(tokens.open(sealed,'selection').user).toBe('a');
    expect(tokens.open(sealed,'spotify-access')).toBeNull();
    expect(tokens.open('x'+sealed.slice(1),'selection')).toBeNull();
    vi.advanceTimersByTime(1001);expect(tokens.open(sealed,'selection')).toBeNull();
  });
});
describe('timed lyrics provider',()=>{
  const track={id:'track',title:'Fixture',artistName:'Artist',duration:180};
  it('uses exact metadata, parses multi timestamps and offsets, caches without inventing timing',async()=>{
    const fetchImpl=vi.fn(async()=>json({trackName:'Fixture',artistName:'Artist',duration:181,syncedLyrics:'[offset:-500]\n[00:01.5][00:03.250]First\n[00:04]Second'}));
    const lookup=lyricsModule.createLyricsProvider({fetchImpl,env:{}});
    const result=await lookup(track);
    expect(result).toMatchObject({source:'LRCLIB',lyricsType:'SYNCED',lyricsSynced:[{time:1,text:'First'},{time:2.75,text:'First'},{time:3.5,text:'Second'}]});
    await lookup(track);expect(fetchImpl).toHaveBeenCalledTimes(1);
    const wrong=lyricsModule.createLyricsProvider({fetchImpl:async()=>json({trackName:'Fixture live',artistName:'Artist',duration:180,plainLyrics:'Wrong'}),env:{}});
    expect((await wrong(track)).hasLyrics).toBe(false);
  });
  it('preserves artist lyrics without contacting a third party',async()=>{
    const fetchImpl=vi.fn();const lookup=lyricsModule.createLyricsProvider({fetchImpl,env:{}});
    expect((await lookup({...track,lyricsText:'Authored',lyricsType:'PLAIN',lyricsRightsConfirmed:true})).lyricsText).toBe('Authored');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
describe('official playlist providers',()=>{
  it.each([717,1000,1001])('reads every Spotify page in order up to the safe bound: %i positions',async total=>{
    const offsets=[];
    const fetchImpl=async url=>{
      if(!url.includes('/items'))return json({name:'Full list',snapshot_id:'v1'});
      const offset=Number(new URL(url).searchParams.get('offset'));offsets.push(offset);
      return json({total,next:offset+50<total?'unused-provider-url':null,items:Array.from({length:Math.min(50,total-offset)},(_,index)=>({item:{type:'track',id:'1234567890123456789012',name:`Position ${offset+index+1}`,artists:[{name:'Artist'}]}}))});
    };
    const source=sourceModule.createPlaylistSources({fetchImpl,env:{SPOTIFY_CLIENT_ID:'fixture',SPOTIFY_REDIRECT_URI:'https://example.test/callback'}});
    const result=await source.load('https://open.spotify.com/playlist/1234567890123456789012','fixture');
    const size=Math.min(1000,total);
    expect(result.entries).toHaveLength(size);expect(result.entries.at(-1).title).toBe(`Position ${size}`);
    expect(result.truncated).toBe(total>1000);expect(offsets).toEqual(Array.from({length:Math.ceil(size/50)},(_,i)=>i*50));
  });
  it('rejects an incomplete or changing playlist rather than saving a partial snapshot',async()=>{
    for(const scenario of ['snapshot','count']) {
      let metadataCalls=0;
      const fetchImpl=async url=>{
        if(!url.includes('/items'))return json({name:'Changed',snapshot_id:++metadataCalls===1?'v1':scenario==='snapshot'?'v2':'v1'});
        return json({items:[{item:{type:'track',name:'One'}}],total:2,next:null});
      };
      const source=sourceModule.createPlaylistSources({fetchImpl,env:{SPOTIFY_CLIENT_ID:'fixture',SPOTIFY_REDIRECT_URI:'https://example.test/callback'}});
      await expect(source.load('https://open.spotify.com/playlist/1234567890123456789012','fixture')).rejects.toMatchObject({code:'IMPORT_PLAYLIST_CHANGED'});
    }
  });
  it('retains Spotify local files as unavailable source positions',async()=>{
    const fetchImpl=vi.fn(async url=>{
      if(!url.includes('/items'))return json({name:'Fixture list',snapshot_id:'v1'});
      return json({items:[{item:{type:'track',name:'Track',artists:[{name:'Artist'}],duration_ms:180000}},{is_local:true,item:{name:'Local'}}],total:2,next:null});
    });
    const source=sourceModule.createPlaylistSources({fetchImpl,env:{SPOTIFY_CLIENT_ID:'fixture',SPOTIFY_REDIRECT_URI:'https://example.test/callback'}});
    const result=await source.load('https://open.spotify.com/playlist/1234567890123456789012','fixture-token');
    expect(result).toMatchObject({name:'Fixture list',skipped:0,entries:[{title:'Track',artist:'Artist',duration:180},{title:'Local',unavailable:true,sourceId:null}]});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][0]).toContain('/items?limit=50');
  });
  it('uses SoundCloud URNs and validates resolve redirects and pagination before sending auth',async()=>{
    const calls=[];const fetchImpl=async url=>{
      calls.push(String(url));
      if(String(url).includes('/oauth/token'))return json({access_token:'fixture',expires_in:3600});
      if(String(url).includes('/resolve'))return new Response(null,{status:302,headers:{location:'https://api.soundcloud.com/playlists/soundcloud:playlists:123'}});
      if(!String(url).includes('/tracks?'))return json({kind:'playlist',urn:'soundcloud:playlists:123',title:'Set',track_count:2});
      if(String(url).includes('offset=1'))return json({collection:[{title:'Second',metadata_artist:'Artist',duration:90000}],next_href:null});
      return json({collection:[{title:'First',user:{username:'Uploader'},duration:100000}],next_href:'https://api.soundcloud.com/playlists/soundcloud:playlists:123/tracks?offset=1'});
    };
    const source=sourceModule.createPlaylistSources({fetchImpl,env:{SOUNDCLOUD_CLIENT_ID:'fixture',SOUNDCLOUD_CLIENT_SECRET:'fixture'}});
    const result=await source.load('https://soundcloud.com/fixture/sets/list');
    expect(result.entries).toHaveLength(2);expect(result.entries[0].needsReview).toBe(true);
    expect(calls[3]).toContain(encodeURIComponent('soundcloud:playlists:123'));
    const unsafe=sourceModule.createPlaylistSources({fetchImpl:async url=>String(url).includes('/oauth/token')?json({access_token:'fixture'}):new Response(null,{status:302,headers:{location:'https://evil.test/playlists/123'}}),env:{SOUNDCLOUD_CLIENT_ID:'fixture',SOUNDCLOUD_CLIENT_SECRET:'fixture'}});
    await expect(unsafe.load('https://soundcloud.com/fixture/sets/list')).rejects.toMatchObject({code:'IMPORT_PROVIDER_UNAVAILABLE'});
  });
  it('keeps YouTube uploader-derived metadata for manual review and reports removed videos',async()=>{
    const source=sourceModule.createPlaylistSources({env:{YOUTUBE_API_KEY:'fixture'},fetchImpl:async url=>String(url).includes('/playlists?')?json({items:[{snippet:{title:'List'}}]}):json({items:[{snippet:{title:'Artist - Song'}},{snippet:{title:'Private video'}}],pageInfo:{totalResults:2}})});
    const result=await source.load('https://youtube.com/playlist?list=PLabcdefghijk');
    expect(result).toMatchObject({skipped:0,entries:[{title:'Song',artist:'Artist',needsReview:true},{title:'Private video',unavailable:true,sourceId:null}]});
  });
  it('does not fetch if a provider is unconfigured',async()=>{
    const fetchImpl=vi.fn();const source=sourceModule.createPlaylistSources({fetchImpl,env:{}});
    await expect(source.load('https://youtube.com/playlist?list=PLabcdefghijk')).rejects.toMatchObject({code:'IMPORT_NOT_CONFIGURED'});expect(fetchImpl).not.toHaveBeenCalled();
  });
});
