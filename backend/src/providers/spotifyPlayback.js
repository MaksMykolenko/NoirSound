'use strict';
const { CatalogError } = require('../lib/externalCatalog');
const SCOPES = ['streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state', 'user-modify-playback-state'];
const hasPlaybackScopes = scope => SCOPES.every(value => String(scope || '').split(' ').includes(value));

function createSpotifyPlayback({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  async function request(url, options) {
    let response;
    try { response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) }); }
    catch { throw new CatalogError('SPOTIFY_PLAYBACK_UNAVAILABLE', 502); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new CatalogError(response.status === 401 ? 'SPOTIFY_PLAYBACK_CONNECT' : response.status === 403 ? 'SPOTIFY_PLAYBACK_PREMIUM' : response.status === 429 ? 'SPOTIFY_PLAYBACK_RATE_LIMIT' : 'SPOTIFY_PLAYBACK_UNAVAILABLE', response.status === 429 ? 429 : 409);
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
      body: JSON.stringify({ uris: ['spotify:track:' + sourceId] }),
    });
    await response.body?.cancel();
  }
  return { refresh, play };
}
module.exports = { createSpotifyPlayback, SCOPES, hasPlaybackScopes };
