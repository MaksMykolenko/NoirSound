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
export function createSpotifyController(initialCallbacks) {
  let callbacks = initialCallbacks;
  let player, connection, destroyed = false, timer, readyTimer, stateTimer, rejectReady, started = false;
  let uri, lastPosition = 0, lastDuration = 0, ended = false, seekingUntil = 0, seenTarget = false;
  let generation = 0, commands = Promise.resolve();
  const abort = new AbortController();
  const fail = code => { if (!destroyed) callbacks.onError(code); };
  function receive(state) {
    if (destroyed || !started || !state || ended) return;
    const current = state.track_window?.current_track;
    const changedTrack = current?.uri && current.uri !== uri;
    // Spotify can report the previous track immediately after accepting play.
    // Only a state for this request may start or finish the NoirSound item.
    if (!seenTarget && current?.uri !== uri) return;
    seenTarget = true;
    clearTimeout(stateTimer);
    const finished = state.position < 500 && lastDuration > 0 && lastPosition >= lastDuration - 1800 && Date.now() > seekingUntil;
    if (changedTrack || finished) {
      ended = true;
      suspend();
      callbacks.onEnded();
      return;
    }
    lastPosition = state.position;
    lastDuration = state.duration;
    callbacks.onState({ isPlaying: !state.paused, progress: state.position / 1000, duration: state.duration / 1000, coverUrl: current?.album?.images?.[0]?.url });
  }
  function connect(volume) {
    if (!connection) connection = (async () => {
      // Resolve access before loading the SDK, so a missing grant cannot leave
      // an invisible device connected or display a misleading playing state.
      let token = await spotifyPlaybackToken(abort.signal);
      const SDK = await loadSpotifySDK();
      if (destroyed) return;
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
      try { return await ready; } finally { clearTimeout(readyTimer); rejectReady = null; }
    })();
    return connection;
  }
  function suspend() {
    ++generation;
    const wasStarted = started;
    started = false;
    clearInterval(timer);
    clearTimeout(stateTimer);
    if (wasStarted) commands = commands.catch(() => {}).then(() => player?.pause()).catch(() => {});
  }
  return {
    async start(track, volume, nextCallbacks = callbacks) {
      suspend();
      callbacks = nextCallbacks;
      const requestGeneration = generation;
      // Keep one Spotify device and serialize play commands. Disconnecting and
      // registering a device for every Next races Spotify Connect registration.
      const task = commands.catch(() => {}).then(async () => {
        if (destroyed || requestGeneration !== generation) return;
        const deviceId = await connect(volume);
        if (destroyed || requestGeneration !== generation) return;
        await player.activateElement();
        if (destroyed || requestGeneration !== generation) return;
        await startSpotifyTrack(track.importedPlaylistId, track.position, deviceId, abort.signal);
        if (destroyed || requestGeneration !== generation) return;
        uri = 'spotify:track:' + track.sourceId;
        lastPosition = 0; lastDuration = 0; ended = false; seenTarget = false;
        seekingUntil = Date.now() + 2000;
        started = true;
        stateTimer = setTimeout(() => { if (!seenTarget && requestGeneration === generation) fail('SPOTIFY_PLAYBACK_UNAVAILABLE'); }, 15000);
        const state = await player.getCurrentState();
        if (destroyed || requestGeneration !== generation) return;
        receive(state);
        timer = setInterval(() => player.getCurrentState().then(value => {
          if (requestGeneration === generation) receive(value);
        }).catch(() => { if (requestGeneration === generation) fail('SPOTIFY_PLAYBACK_UNAVAILABLE'); }), 1000);
      });
      commands = task;
      return task;
    },
    suspend,
    toggle: () => player?.togglePlay(),
    pause: () => player?.pause(),
    seek: seconds => { seekingUntil = Date.now() + 2000; lastPosition = seconds * 1000; return player?.seek(Math.round(seconds * 1000)); },
    volume: value => player?.setVolume(value),
    destroy() {
      destroyed = true; ++generation; abort.abort(); clearInterval(timer); clearTimeout(readyTimer); clearTimeout(stateTimer);
      rejectReady?.(new DOMException('Cancelled', 'AbortError'));
      if (player) { player.disconnect(); player = null; }
    },
  };
}
