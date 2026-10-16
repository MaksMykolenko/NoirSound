import { afterEach, describe, expect, it, vi } from 'vitest';
import importing from '../src/lib/playlistImport';
import tokenModule from '../src/lib/importTokens';
import lyricsModule from '../src/providers/lyrics';
import sourceModule from '../src/providers/playlistSources';
const {parseImportFile,playlistLink,rankCandidates}=importing;
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
afterEach(()=>vi.useRealTimers());

describe('playlist metadata parsing and matching',()=>{
  it('reads quoted Spotify CSV, BOM, commas, millisecond duration, and TXT',()=>{
    expect(parseImportFile('\uFEFFTrack Name,Artist Name(s),Duration (ms)\r\n"Song, part 1",Artist,180500')).toEqual([{title:'Song, part 1',artist:'Artist',duration:180.5}]);
    expect(parseImportFile('Artist - Track')).toEqual([{title:'Track',artist:'Artist',duration:null}]);
    expect(parseImportFile('title;artist;duration\nTrack;Artist;3:02')[0].duration).toBe(182);
  });
  it('rejects oversized and malformed files instead of silently dropping records',()=>{
    expect(()=>parseImportFile('title,artist\n"broken,Artist')).toThrow();
    expect(()=>parseImportFile(Array(201).fill('Artist - Track').join('\n'))).toThrow('IMPORT_TOO_LARGE');
  });
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
  it('paginates Spotify items, skips local files and checks snapshot consistency',async()=>{
    const fetchImpl=vi.fn(async url=>{
      if(!url.includes('/items'))return json({name:'Fixture list',snapshot_id:'v1'});
      return json({items:[{item:{type:'track',name:'Track',artists:[{name:'Artist'}],duration_ms:180000}},{is_local:true,item:{name:'Local'}}],total:2,next:null});
    });
    const source=sourceModule.createPlaylistSources({fetchImpl,env:{SPOTIFY_CLIENT_ID:'fixture',SPOTIFY_REDIRECT_URI:'https://example.test/callback'}});
    const result=await source.load('https://open.spotify.com/playlist/1234567890123456789012','fixture-token');
    expect(result).toMatchObject({name:'Fixture list',skipped:1,entries:[{title:'Track',artist:'Artist',duration:180}]});
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
    expect(result).toMatchObject({skipped:1,entries:[{title:'Song',artist:'Artist',needsReview:true}]});
  });
  it('does not fetch if a provider is unconfigured',async()=>{
    const fetchImpl=vi.fn();const source=sourceModule.createPlaylistSources({fetchImpl,env:{}});
    await expect(source.load('https://youtube.com/playlist?list=PLabcdefghijk')).rejects.toMatchObject({code:'IMPORT_NOT_CONFIGURED'});expect(fetchImpl).not.toHaveBeenCalled();
  });
});
