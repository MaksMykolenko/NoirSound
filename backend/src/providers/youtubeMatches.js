'use strict';

const crypto = require('node:crypto');
const { CatalogError } = require('../lib/externalCatalog');
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function relevance(entry, item) {
  const title=normalize(entry.title),artist=normalize(entry.artist),other=normalize(item.title),channel=normalize(item.channel).replace(/ topic$/,'');
  const words=title.split(' ').filter(Boolean),matched=words.filter(word=>other.split(' ').includes(word)).length;
  return (words.length?matched/words.length*50:0)+(artist&&channel===artist?30:artist&&other.includes(artist)?15:0)+(entry.duration&&item.duration&&Math.abs(entry.duration-item.duration)<5?10:0);
}

function youtubeVideoId(value) {
  let url;
  try { url = new URL(value); } catch { throw new CatalogError('IMPORT_VIDEO_INVALID', 400); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new CatalogError('IMPORT_VIDEO_INVALID', 400);
  const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : ['youtube.com', 'www.youtube.com', 'music.youtube.com', 'm.youtube.com'].includes(url.hostname) && url.pathname === '/watch' ? url.searchParams.get('v') : null;
  if (!videoIdPattern.test(id || '')) throw new CatalogError('IMPORT_VIDEO_INVALID', 400);
  return id;
}

function createYoutubeMatches({ env = process.env, fetchImpl = globalThis.fetch, redis = null, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map();
  let localDay, localSearches = 0;
  const configured = () => Boolean(env.YOUTUBE_API_KEY);
  async function api(path, query) {
    if (!configured()) throw new CatalogError('IMPORT_NOT_CONFIGURED', 409);
    let response;
    try { response = await fetchImpl('https://www.googleapis.com/youtube/v3/' + path + '?' + new URLSearchParams({ ...query, key: env.YOUTUBE_API_KEY }), { redirect: 'error', signal: AbortSignal.timeout(10000) }); }
    catch { throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE', 502); }
    const reader = response.body.getReader(), chunks = [];
    let size = 0;
    try {
      for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 500000) throw new CatalogError('IMPORT_RESPONSE_TOO_LARGE', 502); chunks.push(value); }
    } finally { await reader.cancel(); }
    let result;
    try { result = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE', 502); }
    if (!response.ok) {
      const quota = response.status === 429 || result.error?.errors?.some(error => ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'].includes(error.reason));
      throw new CatalogError(quota ? 'IMPORT_SEARCH_QUOTA' : 'IMPORT_PROVIDER_UNAVAILABLE', quota ? 429 : 502);
    }
    if (!Array.isArray(result.items)) throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE', 502);
    return result.items;
  }
  async function videos(ids) {
    if (!ids.length) return [];
    const rows = await api('videos', { part: 'snippet,contentDetails,status', id: ids.join(',') });
    return rows.filter(row => videoIdPattern.test(row.id || '') && row.status?.embeddable === true && row.status.privacyStatus === 'public' && row.snippet?.liveBroadcastContent === 'none' && row.contentDetails?.contentRating?.ytRating !== 'ytAgeRestricted').map(row => {
      const duration = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(row.contentDetails?.duration || '');
      return { videoId: row.id, title: String(row.snippet.title || '').slice(0, 300), channel: String(row.snippet.channelTitle || '').slice(0, 200), duration: duration ? Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(duration[3] || 0) : null };
    });
  }
  async function reserveSearch() {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(now()));
    const limit = Math.max(1, Math.min(Number(env.YOUTUBE_MATCH_SEARCHES_PER_DAY) || 95, 10000));
    let count;
    if (redis) {
      try { count = await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],172800) end; return n", 1, 'noirsound:youtube-search-budget:' + day); }
      catch { throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE', 503); }
    } else {
      if (localDay !== day) { localDay = day; localSearches = 0; }
      count = ++localSearches;
    }
    if (count > limit) throw new CatalogError('IMPORT_SEARCH_QUOTA', 429);
  }
  async function search(entry) {
    if (!configured()) throw new CatalogError('IMPORT_NOT_CONFIGURED', 409);
    const query = (entry.artist + ' ' + entry.title).normalize('NFKC').trim().slice(0, 400);
    const key = 'noirsound:youtube-matches:' + crypto.createHash('sha256').update(query).digest('hex');
    const previous = cache.get(key);
    const ranked=items=>[...items].sort((a,b)=>relevance(entry,b)-relevance(entry,a));
    if (previous?.expires > now()) return ranked(previous.items);
    if (pending.has(key)) return ranked(await pending.get(key));
    const work = (async () => {
      if (redis) {
        try { const stored = await redis.get(key); if (stored) return JSON.parse(stored); }
        catch { throw new CatalogError('IMPORT_PROVIDER_UNAVAILABLE', 503); }
      }
      await reserveSearch();
      const rows = await api('search', { part: 'snippet', type: 'video', maxResults: '5', q: query, videoEmbeddable: 'true', videoSyndicated: 'true' });
      const items = await videos([...new Set(rows.map(row => row.id?.videoId).filter(id => videoIdPattern.test(id || '')))]);
      if (cache.size >= 1000) cache.delete(cache.keys().next().value);
      cache.set(key, { expires: now() + 86400000, items });
      if (redis) { try { await redis.set(key, JSON.stringify(items), 'EX', 86400); } catch { /* The local cache still avoids repeat requests. */ } }
      return items;
    })().finally(() => pending.delete(key));
    pending.set(key, work);
    return ranked(await work);
  }
  return { configured, search, inspect: async url => { const rows = await videos([youtubeVideoId(url)]); if (!rows.length) throw new CatalogError('IMPORT_VIDEO_UNAVAILABLE', 409); return rows[0]; } };
}

module.exports = { createYoutubeMatches, youtubeVideoId };
