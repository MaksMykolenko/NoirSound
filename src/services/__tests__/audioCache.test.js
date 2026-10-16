import {describe,it,expect,vi} from 'vitest';
import {createAudioCache,AUDIO_TRACK_LIMIT} from '../audioCache';
import {nextQueuedTrack} from '../playerPreload';
function fixture(fetchImpl) {
  const rows=new Map();
  const store={read:vi.fn(async id=>rows.get(id)?.blob),write:vi.fn(async row=>rows.set(row.id,row)),clear:vi.fn(async()=>rows.clear())};
  return {cache:createAudioCache({store,fetchImpl,enabled:()=>true}),store,rows};
}
const descriptor={url:'https://audio.example.test/signed?signature=temporary',cacheKey:'content-v1'};
const audioResponse=()=>new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}});
describe('bounded audio cache',()=>{
  it('stores audio blobs, isolates identities, and never persists signed URLs',async()=>{
    const {cache,rows}=fixture(async()=>audioResponse());
    await cache.warm('a',descriptor);
    expect((await cache.get('a',descriptor)).size).toBe(3);
    expect(await cache.get('b',descriptor)).toBeFalsy();
    expect(await cache.get('a',{...descriptor,cacheKey:'content-v2'})).toBeFalsy();
    expect(JSON.stringify([...rows.values()])).not.toContain('signature');
  });
  it('cannot repopulate the cache after logout/clear while a response is in flight',async()=>{
    let deliver;const {cache,store}=fixture(()=>new Promise(resolve=>{deliver=resolve;}));
    const pending=cache.warm('a',descriptor);await vi.waitFor(()=>expect(deliver).toBeTypeOf('function'));
    await cache.clear();deliver(audioResponse());await pending;
    expect(store.write).not.toHaveBeenCalled();
  });
  it('aborts obsolete preloads, declines partial/oversized audio and tolerates quotas',async()=>{
    const abort=new AbortController();abort.abort();
    const f=vi.fn(async()=>audioResponse());const {cache}=fixture(f);
    await cache.warm('a',descriptor,abort.signal);expect(f).not.toHaveBeenCalled();
    for(const response of [new Response('partial',{status:206,headers:{'content-type':'audio/mpeg'}}),new Response('large',{headers:{'content-type':'audio/mpeg','content-length':String(AUDIO_TRACK_LIMIT+1)}}),new Response('<html>login</html>')]) {
      const entry=fixture(async()=>response);await entry.cache.warm('a',descriptor);expect(entry.store.write).not.toHaveBeenCalled();
    }
    const entry=fixture(async()=>audioResponse());entry.store.write.mockRejectedValue(new Error('QuotaExceededError'));
    await expect(entry.cache.warm('a',descriptor)).resolves.toBeUndefined();
  });
  it('deduplicates a concurrent warm and uses existing blobs',async()=>{
    const f=vi.fn(async()=>audioResponse()),{cache}=fixture(f);
    await Promise.all([cache.warm('a',descriptor),cache.warm('a',descriptor)]);
    await cache.warm('a',descriptor);expect(f).toHaveBeenCalledTimes(1);
  });
});
describe('next-track preparation',()=>{
  const a={id:'a'},b={id:'b'},c={id:'c'};
  it('uses the visible queue including reorder, wrap and repeat-one',()=>{
    expect(nextQueuedTrack({currentTrack:a,queue:[a,c,b],repeatMode:'none'})).toBe(c);
    expect(nextQueuedTrack({currentTrack:b,queue:[a,b],repeatMode:'none'})).toBeNull();
    expect(nextQueuedTrack({currentTrack:b,queue:[a,b],repeatMode:'all'})).toBe(a);
    expect(nextQueuedTrack({currentTrack:b,queue:[a,b],repeatMode:'one'})).toBe(b);
  });
});
