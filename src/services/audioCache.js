export const AUDIO_CACHE_LIMIT = 80 * 1024 * 1024;
export const AUDIO_TRACK_LIMIT = 24 * 1024 * 1024;
export const AUDIO_CACHE_TTL = 6 * 60 * 60 * 1000;
const preference = 'noirsound.audioCache';
let dbPromise;

export function supportsAudioCache() {
  try { return typeof indexedDB !== 'undefined'; } catch { return false; }
}
export function audioCacheEnabled() {
  try { return typeof indexedDB !== 'undefined' && localStorage.getItem(preference) !== 'false'; }
  catch { return false; }
}
export function canWarmAudio() {
  const connection = globalThis.navigator?.connection;
  return audioCacheEnabled() && globalThis.navigator?.onLine !== false &&
    !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType);
}
function database() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('noirsound-audio-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('audio', { keyPath: 'id' });
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); dbPromise = null; };
      resolve(request.result);
    };
    request.onerror = () => { dbPromise = null; reject(request.error); };
    request.onblocked = () => { dbPromise = null; reject(new Error('CACHE_BLOCKED')); };
  });
  return dbPromise;
}
const idbStore = {
  async read(id) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite');
      const store = tx.objectStore('audio');
      const request = store.get(id); let result = null;
      request.onsuccess = () => {
        const row = request.result;
        if (row && row.expires > Date.now()) { result = row.blob; store.put({ ...row, used: Date.now() }); }
        else if (row) store.delete(id);
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
  async write(row) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite');
      const store = tx.objectStore('audio');
      const request = store.getAll();
      request.onsuccess = () => {
        const alive = request.result.filter(item => item.id !== row.id && item.expires > Date.now()).sort((a, b) => a.used - b.used);
        for (const item of request.result) if (item.expires <= Date.now()) store.delete(item.id);
        let bytes = alive.reduce((sum, item) => sum + item.blob.size, row.blob.size);
        while (alive.length && (bytes > AUDIO_CACHE_LIMIT || alive.length >= 50)) {
          const oldest = alive.shift(); bytes -= oldest.blob.size; store.delete(oldest.id);
        }
        store.put(row);
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
  async clear() {
    if (typeof indexedDB === 'undefined') return;
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').clear();
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  },
};

export function createAudioCache({ store = idbStore, fetchImpl = (...args) => fetch(...args), enabled = audioCacheEnabled, now = Date.now } = {}) {
  let epoch = 0, writes = Promise.resolve();
  const pending = new Map();
  const key = (scope, descriptor) => descriptor?.cacheKey ? scope + ':' + descriptor.cacheKey : null;
  const serialize = fn => { const result = writes.then(fn); writes = result.catch(() => {}); return result; };
  return {
    async get(scope, descriptor) {
      const id = key(scope, descriptor), generation = epoch;
      if (!id || !enabled()) return null;
      try { const blob = await store.read(id); return generation === epoch && enabled() ? blob : null; } catch { return null; }
    },
    async warm(scope, descriptor, signal) {
      const id = key(scope, descriptor), generation = epoch;
      if (!id || !enabled() || signal?.aborted || pending.has(id)) return;
      const operation = (async () => {
        if (await this.get(scope, descriptor) || signal?.aborted || generation !== epoch) return;
        const response = await fetchImpl(descriptor.url, { signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(45000)]), credentials: 'omit', mode: 'cors', cache: 'no-store' });
        const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
        if (!response.ok || response.status === 206 || !type.startsWith('audio/') ||
            Number(response.headers.get('content-length')) > AUDIO_TRACK_LIMIT) { await response.body?.cancel(); return; }
        const reader = response.body.getReader(); const chunks = []; let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.length;
            if (size > AUDIO_TRACK_LIMIT || signal?.aborted || generation !== epoch) return;
            chunks.push(value);
          }
        } finally { await reader.cancel(); }
        if (!size) return;
        const blob = new Blob(chunks, { type });
        await serialize(async () => {
          if (signal?.aborted || generation !== epoch || !enabled()) return;
          await store.write({ id, blob, used: now(), expires: now() + AUDIO_CACHE_TTL });
        });
      })().catch(() => { /* CORS, network and quota failures leave ordinary streaming usable. */ });
      pending.set(id, operation);
      try { await operation; } finally { if (pending.get(id) === operation) pending.delete(id); }
    },
    async clear() {
      epoch++;
      await serialize(() => store.clear()).catch(() => {});
    },
  };
}
export const audioCache = createAudioCache();
export function setAudioCacheEnabled(enabled) {
  try { localStorage.setItem(preference, String(enabled)); } catch { /* Optional storage. */ }
  window.dispatchEvent(new Event('noirsound:audio-cache-change'));
  if (!enabled) return audioCache.clear();
}
