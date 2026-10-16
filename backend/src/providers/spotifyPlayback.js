'use strict';
const { CatalogError } = require('../lib/externalCatalog');
const SCOPES = ['streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state', 'user-modify-playback-state'];
const hasPlaybackScopes = scope => SCOPES.every(value => String(scope || '').split(' ').includes(value));

function createSpotifyPlayback({ fetchImpl = globalThis.fetch, env = process.env, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  async function request(url, options, retryDevice = false) {
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) }); }
      catch { throw new CatalogError('SPOTIFY_PLAYBACK_UNAVAILABLE', 502); }
      // A newly registered SDK device may emit ready just before the Web API
      // can address it. Retry only that device, never another connected device.
      if (!retryDevice || response.status !== 404 || attempt === 2) break;
      await response.body?.cancel();
      await delay((attempt + 1) * 500);
    }
    if (!response.ok) {
      await response.body?.cancel();
      const error = new CatalogError(response.status === 401 ? 'SPOTIFY_PLAYBACK_CONNECT' : response.status === 403 ? 'SPOTIFY_PLAYBACK_PREMIUM' : response.status === 429 ? 'SPOTIFY_PLAYBACK_RATE_LIMIT' : 'SPOTIFY_PLAYBACK_UNAVAILABLE', response.status === 429 ? 429 : 409);
      error.upstreamStatus = response.status;
      throw error;
    }
    return response;
  }
  async function refresh(refreshToken) {
    const response = await request('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: env.SPOTIFY_CLIENT_ID }),
    });
    const data = await response.json();
    if (!data.access_token) throw new CatalogError('SPOTIFY_PLAYBACK_CONNECT', 409);
    return { access: data.access_token, refresh: data.refresh_token || refreshToken, scope: data.scope, tokenExpires: Date.now() + Math.min(Number(data.expires_in) || 3600, 3600) * 1000 };
  }
  async function play(access, deviceId, sourceId) {
    const response = await request('https://api.spotify.com/v1/me/player/play?' + new URLSearchParams({ device_id: deviceId }), {
      method: 'PUT', headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: ['spotify:track:' + sourceId], position_ms: 0 }),
    }, true);
    await response.body?.cancel();
  }
  return { refresh, play };
}
module.exports = { createSpotifyPlayback, SCOPES, hasPlaybackScopes };
