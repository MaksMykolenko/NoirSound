import { spotifyPlaybackToken, startSpotifyTrack } from '../api/playlistImport';

let sdkPromise;
export function loadSpotifySDK() {
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail(), 15000);
    const fail = () => { clearTimeout(timer); script.remove(); sdkPromise = null; reject(new Error('SPOTIFY_PLAYBACK_UNAVAILABLE')); };
    window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timer); resolve(window.Spotify); };
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return sdkPromise;
}

// The SDK supplies audio only. All visible controls remain in PlayerBar.
// Tokens live in memory; neither Spotify audio nor tokens enter the audio cache.
export function createSpotifyController({ onState, onEnded, onError }) {
  let player, destroyed = false, timer, readyTimer, rejectReady, started = false;
  let uri, lastPosition = 0, lastDuration = 0, ended = false, seekingUntil = 0;
  const abort = new AbortController();
  const fail = code => { if (!destroyed) onError(code); };
  function receive(state) {
    if (destroyed || !started || !state || ended) return;
    const current = state.track_window?.current_track;
    const changedTrack = current?.uri && current.uri !== uri;
    const finished = state.position < 500 && lastDuration > 0 && lastPosition >= lastDuration - 1800 && Date.now() > seekingUntil;
    if (changedTrack || finished) {
      ended = true;
      player.pause().catch(() => {});
      onEnded();
      return;
    }
    lastPosition = state.position;
    lastDuration = state.duration;
    onState({ isPlaying: !state.paused, progress: state.position / 1000, duration: state.duration / 1000, coverUrl: current?.album?.images?.[0]?.url });
  }
  return {
    async start(track, volume) {
      // Resolve access before loading the SDK, so a missing grant cannot leave
      // an invisible device connected or display a misleading playing state.
      let token = await spotifyPlaybackToken(abort.signal);
      const SDK = await loadSpotifySDK();
      if (destroyed) return;
      uri = 'spotify:track:' + track.sourceId;
      player = new SDK.Player({ name: 'NoirSound', volume,
        getOAuthToken: callback => {
          if (destroyed) return;
          if (token.expiresAt > Date.now() + 30000) { callback(token.accessToken); return; }
          spotifyPlaybackToken(abort.signal).then(fresh => { token = fresh; if (!destroyed) callback(fresh.accessToken); }).catch(error => fail(error.code || 'SPOTIFY_PLAYBACK_CONNECT'));
        },
      });
      player.addListener('player_state_changed', receive);
      player.addListener('autoplay_failed', () => fail('SPOTIFY_PLAYBACK_AUTOPLAY'));
      for (const [event, code] of Object.entries({ authentication_error: 'SPOTIFY_PLAYBACK_CONNECT', account_error: 'SPOTIFY_PLAYBACK_PREMIUM', initialization_error: 'SPOTIFY_PLAYBACK_UNAVAILABLE', playback_error: 'SPOTIFY_PLAYBACK_UNAVAILABLE', not_ready: 'SPOTIFY_PLAYBACK_UNAVAILABLE' })) {
        player.addListener(event, () => { rejectReady?.(new Error(code)); fail(code); });
      }
      const ready = new Promise((resolve, reject) => {
        rejectReady = reject;
        readyTimer = setTimeout(() => reject(new Error('SPOTIFY_PLAYBACK_UNAVAILABLE')), 15000);
        player.addListener('ready', ({ device_id }) => resolve(device_id));
        player.connect().then(connected => { if (!connected) reject(new Error('SPOTIFY_PLAYBACK_UNAVAILABLE')); }).catch(reject);
      });
      let deviceId;
      try { deviceId = await ready; } finally { clearTimeout(readyTimer); rejectReady = null; }
      if (destroyed) return;
      await player.activateElement();
      await startSpotifyTrack(track.importedPlaylistId, track.position, deviceId, abort.signal);
      if (destroyed) return;
      started = true;
      receive(await player.getCurrentState());
      timer = setInterval(() => player.getCurrentState().then(receive).catch(() => fail('SPOTIFY_PLAYBACK_UNAVAILABLE')), 1000);
    },
    toggle: () => player?.togglePlay(),
    pause: () => player?.pause(),
    seek: seconds => { seekingUntil = Date.now() + 2000; lastPosition = seconds * 1000; return player?.seek(Math.round(seconds * 1000)); },
    volume: value => player?.setVolume(value),
    destroy() {
      destroyed = true; abort.abort(); clearInterval(timer); clearTimeout(readyTimer);
      rejectReady?.(new DOMException('Cancelled', 'AbortError'));
      if (player) { player.disconnect(); player = null; }
    },
  };
}
