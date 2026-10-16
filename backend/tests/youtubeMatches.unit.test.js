import {describe,it,expect,vi} from 'vitest';
import module from '../src/providers/youtubeMatches';
const {createYoutubeMatches,youtubeVideoId}=module;
const video=(id='abcdefghijk',extra={})=>({id,snippet:{title:'Artist — Song',channelTitle:'Artist',liveBroadcastContent:'none'},contentDetails:{duration:'PT3M2S'},status:{embeddable:true,privacyStatus:'public'},...extra});
describe('YouTube versions for imported tracks',()=>{
  it('searches only embeddable videos, shares concurrent requests, and caches results',async()=>{
    const fetchImpl=vi.fn(async url=>new Response(JSON.stringify({items:new URL(url).pathname.endsWith('/search')?[{id:{videoId:'abcdefghijk'}},{id:{videoId:'bad'}}]:[video(),video('private0000',{status:{embeddable:false,privacyStatus:'private'}})]})));
    const service=createYoutubeMatches({env:{YOUTUBE_API_KEY:'private-key'},fetchImpl});
    const entry={title:'Song',artist:'Artist'};
    const [a,b]=await Promise.all([service.search(entry),service.search(entry)]);
    expect(a).toEqual(b);expect(a).toEqual([{videoId:'abcdefghijk',title:'Artist — Song',channel:'Artist',duration:182}]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get('videoEmbeddable')).toBe('true');
    await service.search(entry);expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('protects the daily search budget while allowing a directly supplied video link',async()=>{
    const fetchImpl=vi.fn(async url=>new Response(JSON.stringify({items:new URL(url).pathname.endsWith('/search')?[]:[video()]})));
    const service=createYoutubeMatches({env:{YOUTUBE_API_KEY:'private-key',YOUTUBE_MATCH_SEARCHES_PER_DAY:'1'},fetchImpl});
    await service.search({title:'First',artist:'Artist'});
    await expect(service.search({title:'Second',artist:'Artist'})).rejects.toMatchObject({code:'IMPORT_SEARCH_QUOTA'});
    expect((await service.inspect('https://youtu.be/abcdefghijk')).videoId).toBe('abcdefghijk');
  });
  it('reports quota errors without leaking upstream credentials or messages',async()=>{
    const service=createYoutubeMatches({env:{YOUTUBE_API_KEY:'private-key'},fetchImpl:vi.fn(async()=>new Response(JSON.stringify({error:{message:'private-key',errors:[{reason:'quotaExceeded'}]}}),{status:403}))});
    await expect(service.search({title:'Song',artist:'Artist'})).rejects.toMatchObject({code:'IMPORT_SEARCH_QUOTA',statusCode:429});
  });
  it.each(['http://youtu.be/abcdefghijk','https://youtube.com.evil.test/watch?v=abcdefghijk','https://user@youtube.com/watch?v=abcdefghijk','https://127.0.0.1/watch?v=abcdefghijk','https://youtu.be/invalid'])('rejects untrusted video links %s',url=>expect(()=>youtubeVideoId(url)).toThrow());
  it('filters age-restricted and live videos from matching',async()=>{
    const service=createYoutubeMatches({env:{YOUTUBE_API_KEY:'private-key'},fetchImpl:vi.fn(async()=>new Response(JSON.stringify({items:[video('abcdefghijk',{contentDetails:{contentRating:{ytRating:'ytAgeRestricted'}}})]})))});
    await expect(service.inspect('https://www.youtube.com/watch?v=abcdefghijk')).rejects.toMatchObject({code:'IMPORT_VIDEO_UNAVAILABLE'});
  });
});
