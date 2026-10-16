import {audioCache,audioCacheEnabled,canWarmAudio} from '../services/audioCache';
import {nextQueuedTrack} from '../services/playerPreload';
import { create } from 'zustand';
import { resolveExternalPlayback, recordExternalPlay, saveCatalogTrack } from '../api/externalCatalog';
import { createSpotifyController } from '../services/spotifyPlayback';
import { importedPlayback } from '../api/playlistImport';
import { API_BASE_URL, useMockApi, apiFetch } from '../api/client';
import { getRecentlyPlayed } from '../api/stats';
import { getLikedTracks, setTrackLiked } from '../api/tracks';
import { useUserStore } from './userStore';
import connectPresenceService from '../services/noirsoundConnect';

function reportPlaybackError(message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('noirsound:api-error', {
      detail: { message, status: 0, source: 'listener-player' },
    }));
  }
}

let audio = null;
let spotifyController = null;
function stopSpotify() { spotifyController?.destroy(); spotifyController = null; }
let playbackGeneration = 0;
let playbackAbort = null;
let activeObjectUrl = null;
let warmTimer = null;
let warmAbort = null;
let currentDescriptor = null;
function cancelWarm() { clearTimeout(warmTimer); warmAbort?.abort(); warmAbort = null; }
function releaseCachedSource() { cancelWarm(); currentDescriptor=null; if(activeObjectUrl){URL.revokeObjectURL(activeObjectUrl);activeObjectUrl=null;} }
const cacheScope = () => useUserStore.getState().user?.id || 'guest';
async function playbackDescriptor(track,signal) {
  if (track.playbackMode==='IMPORTED_SOURCE') throw new Error('IMPORT_AUDIO_UNAVAILABLE');
  if (track.playbackMode==='EXTERNAL_STREAM') {
    const resolved=await resolveExternalPlayback(track,signal);
    if(resolved.playbackMode!=='EXTERNAL_STREAM'||!resolved.url)throw new Error('External audio is unavailable.');
    return resolved;
  }
  if(useMockApi)return {url:track.audioUrl};
  if(track.playbackSource==='landing')return {url:API_BASE_URL+'/landing/tracks/'+encodeURIComponent(track.id)+'/stream'};
  if(audioCacheEnabled())return apiFetch('/tracks/'+encodeURIComponent(track.id)+'/playback',{signal,suppressErrorToast:true});
  return {url:API_BASE_URL+'/tracks/'+encodeURIComponent(track.id)+'/stream'};
}
function scheduleWarm() {
  cancelWarm();
  const state=usePlayerStore.getState();
  if(!state.isPlaying||state.activePlatformEmbed||!currentDescriptor||!canWarmAudio())return;
  const track=state.currentTrack,next=nextQueuedTrack(state),descriptor=currentDescriptor,scope=cacheScope();
  warmAbort=new AbortController(); const signal=warmAbort.signal;
  warmTimer=setTimeout(async()=>{
    try {
      await audioCache.warm(scope,descriptor,signal);
      if(signal.aborted||!next||next.id===track.id||!canStreamTrack(next))return;
      const upcoming=await playbackDescriptor(next,signal);
      if(!signal.aborted&&scope===cacheScope())await audioCache.warm(scope,upcoming,signal);
    }catch { /* Prefetch is optional; foreground playback resolves fresh access again. */ }
  },1200);
}
let stopPlatformFrame = null;
export function registerPlatformFrameStop(stop) {
  stopPlatformFrame = stop;
  return () => { if (stopPlatformFrame === stop) stopPlatformFrame = null; };
}
function stopPlatformPlayback() { stopPlatformFrame?.(); stopPlatformFrame = null; stopSpotify(); }
let configureAudio = () => {};
let likesRequest = null;
let likesGeneration = 0;
const pendingLikes = new Set();

function readVolume() {
  try {
    const saved = window.localStorage.getItem('noirsound.volume');
    const value = saved === null || saved.trim() === '' ? NaN : Number(saved);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.5;
  } catch { return 0.5; }
}

function ensureAudio() {
  if (!audio && typeof window !== 'undefined') {
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    configureAudio();
  }
  return audio;
}

function canStreamTrack(track) {
  if (track?.playbackMode==='IMPORTED_SOURCE') return !track.unavailable;
  if (['LINK_OUT','OFFICIAL_EMBED'].includes(track?.playbackMode)) return false;
  return track?.isStreamable ?? (useMockApi && Boolean(track?.audioUrl));
}

function readPlayerCollapsed() {
  try { return typeof window !== 'undefined' && window.localStorage.getItem('noirsound.playerCollapsed') === 'true'; }
  catch { return false; }
}

function persistPlayerCollapsed(collapsed) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem('noirsound.playerCollapsed', String(collapsed));
  } catch { /* Player controls also work when browser storage is unavailable. */ }
}

if (typeof window !== 'undefined') {
  // Admin routes dispatch this event without importing the listener player.
  // A direct admin load therefore creates no listener audio engine, while an
  // in-app transition safely pauses an engine that was already active.
  window.addEventListener('noirsound:admin-enter', () => { audio?.pause(); usePlayerStore.getState().closePlatformEmbed(); });
}

// --- Qualified-play tracking -------------------------------------------
// A "play" only counts once the user has actually listened for at least
// 30 seconds OR 50% of the track's duration, whichever is smaller (see
// NOIRSOUND_STATS_DATA_AUDIT.md). The backend is always the final
// authority on whether a reported event qualifies -- it recomputes the
// threshold itself from the track's stored duration and never trusts a
// client-sent flag. This client-side tracker exists only to decide *when*
// to send the one report for a given listen: it tracks the furthest
// playhead position reached during real `<audio>` playback (driven by the
// element's own `timeupdate` events), which a page load, a crawler/bot GET
// to the stream URL, or a reload can never produce, since none of those
// ever run a real HTMLMediaElement that fires playback events.
//
// Lives in module scope (like `audio` above) rather than component state
// or Zustand-store fields, so remounts of the player UI can never reset or
// duplicate it -- there is exactly one tracker for the one <audio> element.
let listenState = {
  trackId: null,
  artistId: null,
  accumulatedSeconds: 0,
  qualifyReported: false,
};

function resetListenState(track) {
  listenState = {
    trackId: track?.id ?? null,
    artistId: track?.artistId ?? null,
    accumulatedSeconds: 0,
    qualifyReported: false,
  };
}

export function qualifyThresholdSeconds(durationSeconds) {
  const duration = Number(durationSeconds) || 0;
  if (duration <= 0) return 30;
  return Math.min(30, duration * 0.5);
}

async function reportQualifyingPlay(track, listenedSeconds, completed) {
  // Landing media is public in closed mode, while application stats remain gated.
  // Playback continues on the same singleton without issuing forbidden writes.
  if (track.playbackSource === 'landing' && import.meta.env.VITE_PUBLIC_APP_ENABLED === 'false') return false;
  try {
    if (track.playbackMode === 'EXTERNAL_STREAM') {
      if(!useUserStore.getState().user)return false;
      const result = await recordExternalPlay(track, listenedSeconds, completed);
      return result?.success === true;
    }
    await useUserStore.getState().incrementPlayStats(track.id, track.artistId, {
      durationListenedSeconds: Math.round(listenedSeconds),
      completed: !!completed,
    });
    return true;
  } catch (err) {
    console.warn('Failed to record a qualifying play:', err);
    // Do not flip qualifyReported back off on failure -- retrying mid-listen
    // would risk a duplicate report if the first request actually landed.
    // The next real listen (a fresh track/session) will try again.
    return false;
  }
}

// Exposed only so tests can drive the exact <audio> element the store
// wires up (dispatching real `timeupdate`/`ended` events against it),
// instead of re-implementing or mocking the qualifying-play logic
// separately from what production code actually runs. Not part of the
// app-facing player API.
export function __getAudioElementForTests() {
  return ensureAudio();
}

export const usePlayerStore = create((set, get) => {
  // Tracks the furthest point the real <audio> playhead has reached for
  // the current listen, and fires exactly one qualifying play-event report
  // the moment that crosses min(30s, 50% of duration). Called on every
  // `timeupdate` tick (which only fires during genuine HTMLMediaElement
  // playback -- a page load, a bot/crawler GET to the stream URL, or a
  // reload never produces one) and once more, defensively, on `ended` for
  // very short tracks that can finish before a final tick lands.
  //
  // Using the max reached position (not a sum of per-tick deltas) keeps
  // this simple and avoids any dependency on wall-clock timing or tick
  // frequency. It does mean a deliberate seek straight to the qualifying
  // point would register as qualified without the seconds before it having
  // played -- the ticket's explicit anti-inflation targets are page-load,
  // bot/crawler, and duplicate/reload counting, none of which involve a
  // real browser driving this element's playback events at all, so this
  // tradeoff is deliberate rather than a gap in those specific protections.
  const trackQualifyingProgress = (isEnded = false) => {
    const { currentTrack, duration } = get();
    if (!currentTrack || listenState.trackId !== currentTrack.id) return;
    if (listenState.qualifyReported) return;

    const currentPosition = (audio && audio.currentTime) || 0;
    listenState.accumulatedSeconds = Math.max(listenState.accumulatedSeconds, currentPosition);

    const trackDuration = duration || currentTrack.duration || 0;
    const threshold = qualifyThresholdSeconds(trackDuration);
    if (listenState.accumulatedSeconds >= threshold) {
      listenState.qualifyReported = true;
      const track = currentTrack;
      const listenedSeconds = listenState.accumulatedSeconds;
      reportQualifyingPlay(track, listenedSeconds, isEnded).then((recorded) => {
        // The recently-played list should only ever reflect a listen the
        // backend actually counted -- never an optimistic click. Adding it
        // here, after the qualifying report, keeps it consistent with
        // GET /me/recently-played (qualified-only).
        if (recorded) get().addToRecentlyPlayed(track);
      });
    }
  };

  // Setup audio listeners
  const setupEventListeners = () => {
    if (!audio) return;
    audio.volume = get().volume;
    
    // Clear any existing bindings
    audio.onplay = null;
    audio.onpause = null;
    audio.ontimeupdate = null;
    audio.ondurationchange = null;
    audio.onended = null;
    audio.onerror = null;

    audio.onplay = () => { if (!get().activePlatformEmbed && get().playbackEngine!=='spotify') set({ isPlaying: true }); };
    audio.onpause = () => { if(get().playbackEngine!=='spotify') set({isPlaying:false}); };

    audio.ontimeupdate = () => {
      if (get().activePlatformEmbed || get().playbackEngine==='spotify') return;
      set({ progress: audio.currentTime });
      trackQualifyingProgress();
    };

    audio.ondurationchange = () => {
      if (get().activePlatformEmbed || get().playbackEngine==='spotify') return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        set({ duration: audio.duration });
      }
    };

    audio.onended = () => {
      if (get().activePlatformEmbed || get().playbackEngine==='spotify') return;
      // Safety net for very short tracks: `ended` can fire before the last
      // `timeupdate` tick would have crossed the qualifying threshold.
      trackQualifyingProgress(true);
      get().handleEnded();
    };
    audio.onerror = () => {
      if (get().activePlatformEmbed || get().playbackEngine==='spotify') return;
      const message = get().currentTrack?.playbackMode === 'EXTERNAL_STREAM' ? 'External audio is unavailable. Retry or open Audius.' : 'The processed audio stream could not be loaded.';
      set({
        isPlaying: false,
        playbackError: message
      });
      reportPlaybackError(message);
    };
  };

  configureAudio = setupEventListeners;

  return {
    currentTrack: null,
    activePlatformEmbed: null,
    playbackEngine: 'audio',
    queue: [],
    originalQueue: [],
    queueSource: null,
    isPlaying: false,
    volume: readVolume(),
    progress: 0,
    duration: 0,
    repeatMode: 'none', // 'none' | 'all' | 'one'
    shuffle: false,
    playbackError: null,
    playbackLoading: false,
    likedTracks: useMockApi ? ["1", "2", "5"] : [],
    likedTracksUserId: null,
    likedTracksHydrated: false,
    recentlyPlayed: [],
    recentlyPlayedError: null,
    isPlayerCollapsed: readPlayerCollapsed(),
    lyricsFullscreenOpen: false,

    openLyricsFullscreen: () => {
      if (get().currentTrack && !get().activePlatformEmbed) {
        set({ lyricsFullscreenOpen: true });
      }
    },

    closeLyricsFullscreen: () => {
      set({ lyricsFullscreenOpen: false });
    },

    collapsePlayer: () => {
      if (get().activePlatformEmbed) { get().closePlatformEmbed(); return; }
      set({ isPlayerCollapsed: true });
      persistPlayerCollapsed(true);
    },

    expandPlayer: () => {
      set({ isPlayerCollapsed: false });
      persistPlayerCollapsed(false);
    },

    togglePlayerCollapsed: () => {
      if (get().activePlatformEmbed) { get().closePlatformEmbed(); return; }
      const nextCollapsed = !get().isPlayerCollapsed;
      set({ isPlayerCollapsed: nextCollapsed });
      persistPlayerCollapsed(nextCollapsed);
    },

    updateTrackMetadata: (trackId, updates) => {
      set((state) => ({
        currentTrack: state.currentTrack?.id === trackId
          ? { ...state.currentTrack, ...updates }
          : state.currentTrack,
        queue: state.queue.map((track) => track.id === trackId ? { ...track, ...updates } : track),
        originalQueue: state.originalQueue.map((track) =>
          track.id === trackId ? { ...track, ...updates } : track
        ),
        recentlyPlayed: state.recentlyPlayed.map((track) =>
          track.id === trackId ? { ...track, ...updates } : track
        ),
      }));
    },

    loadLikedTracks: (userId) => {
      if (get().likedTracksUserId !== userId || !userId) {
        likesGeneration += 1;
        likesRequest = null;
        set({ likedTracks: [], likedTracksUserId: userId, likedTracksHydrated: false });
      }
      if (!userId || get().likedTracksHydrated) return Promise.resolve();
      if (likesRequest) return likesRequest;
      const generation = likesGeneration;
      likesRequest = getLikedTracks().then((tracks) => {
        if (generation !== likesGeneration) return;
        set({ likedTracks: [...new Set(tracks.map((track) => track.id))], likedTracksHydrated: true });
      }).finally(() => {
        if (generation === likesGeneration) likesRequest = null;
      });
      return likesRequest;
    },

    toggleLikeTrack: async (trackId) => {
      if(String(trackId).startsWith('source:'))return;
      const userId = useUserStore.getState().user?.id;
      if (!userId) {
        useUserStore.getState().setAuthModalOpen(true);
        return;
      }
      const pendingKey = `${userId}:${trackId}`;
      if (pendingLikes.has(pendingKey)) return;
      pendingLikes.add(pendingKey);
      try {
        await get().loadLikedTracks(userId);
        if (useUserStore.getState().user?.id !== userId) return;
        const generation = likesGeneration;
        const willLike = !get().likedTracks.includes(trackId);
        await setTrackLiked(trackId, willLike);
        if (generation !== likesGeneration || useUserStore.getState().user?.id !== userId) return;
        set((state) => ({
          likedTracks: willLike
            ? [...new Set([...state.likedTracks, trackId])]
            : state.likedTracks.filter((id) => id !== trackId),
        }));
      } catch {
        // apiFetch reports the real failure. Do not apply a local success state.
      } finally {
        pendingLikes.delete(pendingKey);
      }
    },

    addToRecentlyPlayed: (track) => {
      const { recentlyPlayed } = get();
      // Remove if already exists, then add to front
      const filtered = recentlyPlayed.filter(t => t.id !== track.id);
      set({ recentlyPlayed: [track, ...filtered].slice(0, 10) });
    },

    loadRecentlyPlayed: async () => {
      try {
        const tracks = await getRecentlyPlayed();
        set({ recentlyPlayed: tracks, recentlyPlayedError: null });
        return tracks;
      } catch (error) {
        set({ recentlyPlayedError: error.message || 'Listening history is unavailable.' });
        throw error;
      }
    },

    // Compatibility for catalog cards: provider widgets are no longer players.
    openPlatformEmbed: async (_provider, _url, track = null) => {
      await get().playTrack(track || {title:_provider,playbackMode:'LINK_OUT'});
    },
    closePlatformEmbed: () => {
      ++playbackGeneration; playbackAbort?.abort(); stopPlatformPlayback();
      set({activePlatformEmbed:null,isPlaying:false,playbackLoading:false,playbackEngine:'audio'});
    },

    playTrack: async (track, newQueue = null, queueSource = null) => {
      if(track?.previewExternalId && !track.recordingId && !track.guestCatalogPreview) {
        const user=useUserStore.getState().user;
        if(!user){await get().playTrack({...track,guestCatalogPreview:true},newQueue,queueSource);return;}
        const generation=++playbackGeneration;
        playbackAbort?.abort();playbackAbort=new AbortController();
        stopPlatformPlayback();audio?.pause();audio?.removeAttribute?.('src');releaseCachedSource();
        set({activePlatformEmbed:null,playbackEngine:'audio',currentTrack:track,isPlaying:false,progress:0,playbackLoading:true,playbackError:null});
        try {
          const saved=await saveCatalogTrack(track,playbackAbort.signal);
          if(generation!==playbackGeneration||useUserStore.getState().user?.id!==user.id)return;
          const context=newQueue || (get().queue.some(t=>t.id===track.id)?get().queue:null);
          await get().playTrack(saved,context?.map(t=>t.id===track.id?saved:t),queueSource || get().queueSource);
        }catch(error){if(generation===playbackGeneration&&error.name!=='AbortError'){set({playbackLoading:false,playbackError:error.message});reportPlaybackError(error.message);}}
        return;
      }
      if (track?.importedPlaylistId) {
        const userId=useUserStore.getState().user?.id;
        const generation=++playbackGeneration;
        playbackAbort?.abort(); playbackAbort=new AbortController();
        stopPlatformPlayback(); audio?.pause(); audio?.removeAttribute?.('src'); releaseCachedSource();
        if(connectPresenceService.currentTrackId)connectPresenceService.notifyStop();
        const initialQueue=newQueue || get().queue;
        set({activePlatformEmbed:null,currentTrack:track,playbackEngine:'spotify',isPlaying:false,isPlayerCollapsed:false,lyricsFullscreenOpen:false,progress:0,duration:track.duration||0,playbackLoading:true,playbackError:null,queue:initialQueue.filter(canStreamTrack),originalQueue:newQueue?[...initialQueue.filter(canStreamTrack)]:get().originalQueue,queueSource:queueSource||get().queueSource});
        const current=()=>generation===playbackGeneration && useUserStore.getState().user?.id===userId;
        const fail=code=>{if(current())set({isPlaying:false,playbackLoading:false,playbackError:code});};
        try {
          const resolved=await importedPlayback(track.importedPlaylistId,track.position,playbackAbort.signal);
          if(!current())return;
          const selected=resolved.track;
          if(!selected || selected.importedPlaylistId!==track.importedPlaylistId)throw new Error('IMPORT_AUDIO_UNAVAILABLE');
          const queue=(resolved.sourceQueue || initialQueue).filter(canStreamTrack);
          set({currentTrack:selected,queue,...(resolved.sourceQueue||newQueue?{originalQueue:[...queue]}:{}),duration:selected.duration||0});
          if(resolved.playbackMode==='NATIVE' && resolved.nativeTrackId) {
            const native={...selected,id:resolved.nativeTrackId,importedPlaylistId:undefined,playbackMode:'NATIVE',isStreamable:true};
            // Keep source position IDs in the queue, but use real native identity
            // for its ordinary stream, likes, lyrics and play accounting.
            await get().playTrack(native,queue.map(item=>item.id===selected.id?native:item),queueSource||get().queueSource);
            return;
          }
          if(resolved.playbackMode!=='SPOTIFY_SDK' || selected.provider!=='SPOTIFY')throw new Error('IMPORT_AUDIO_UNAVAILABLE');
          spotifyController=createSpotifyController({
            onState:state=>{if(current())set({isPlaying:state.isPlaying,progress:state.progress,duration:state.duration,playbackLoading:false,playbackError:null,...(state.coverUrl?{currentTrack:{...get().currentTrack,coverUrl:state.coverUrl}}:{})});},
            onEnded:()=>{if(current())get().handleEnded();}, onError:code=>{if(current()&&code!=='SPOTIFY_PLAYBACK_AUTOPLAY')stopSpotify();fail(code);},
          });
          await spotifyController.start(selected,get().volume);
        } catch(error) { if(error.name!=='AbortError') { if(current())stopSpotify(); fail(error.code||error.message); } }
        return;
      }
      const generation = ++playbackGeneration;
      playbackAbort?.abort();
      playbackAbort = new AbortController();
      stopPlatformPlayback();
      set({activePlatformEmbed:null,playbackEngine:'audio'});
      ensureAudio();
      if (!audio) return;
      audio.pause();
      audio.removeAttribute?.('src');
      releaseCachedSource();
      set({ isPlaying: false, playbackLoading: false });
      const canPlay = canStreamTrack(track);
      if (!canPlay) {
        const message = 'IMPORT_AUDIO_UNAVAILABLE';
        set({ currentTrack:track,isPlayerCollapsed:false,progress:0,duration:track?.duration||0,isPlaying: false, playbackError: message });
        reportPlaybackError(message);
        return;
      }

      const updates = {
        currentTrack: track,
        progress: 0,
        duration: track.duration || 0,
        playbackError: null,
        playbackLoading: true
      };

      if (newQueue) {
        const streamableQueue = newQueue.filter(canStreamTrack);
        updates.queue = streamableQueue;
        updates.originalQueue = [...streamableQueue];
        updates.queueSource = queueSource;
      }

      set(updates);

      // A new play session -- whether a new track or a restart of the same
      // one -- is a genuinely new listen, so its qualifying-play tracker
      // starts clean. This is the only place listenState resets; pausing
      // and resuming the *same* session (togglePlay) must not reset it, or
      // a user who pauses partway through would lose credit for time
      // already listened.
      resetListenState(track);

      audio.volume = get().volume;
      try {
        const resolved=await playbackDescriptor(track,playbackAbort.signal);
        if(generation!==playbackGeneration)return;
        const cached=await audioCache.get(cacheScope(),resolved);
        if(generation!==playbackGeneration)return;
        currentDescriptor=resolved;
        activeObjectUrl=cached?URL.createObjectURL(cached):null;
        audio.src=activeObjectUrl || resolved.url;
        if (generation !== playbackGeneration) return;
        await audio.play();
        if (generation !== playbackGeneration) return;
        set({ isPlaying: true, playbackLoading: false });
        connectPresenceService.notifyPlay(track, 0);
        // Do NOT report a play or touch recently-played here -- starting
        // playback is not a listen. Both happen only once the qualifying
        // threshold is actually crossed (see trackQualifyingProgress),
        // which is the entire point of this pass: no page-load/click
        // inflation of play counts, monthly listeners, or listening
        // history.
      } catch (err) {
        if (generation !== playbackGeneration) return;
        set({ playbackLoading: false });
        // A quick pause or a new track can cancel an in-flight play request.
        if (err.name === 'AbortError') return;
        console.error('HTML5 audio playback failed.', { code: err.code || err.name });
        const message = err.message || 'Audio playback failed.';
        set({
          isPlaying: false,
          playbackError: message
        });
        reportPlaybackError(message);
      }
    },

    togglePlay: () => {
      if(get().playbackEngine==='spotify') {
        if(get().playbackLoading){get().pause();return;}
        if((get().playbackError && get().playbackError!=='SPOTIFY_PLAYBACK_AUTOPLAY') || !spotifyController){get().playTrack(get().currentTrack);return;}
        spotifyController.toggle()?.catch(()=>set({playbackError:'SPOTIFY_PLAYBACK_UNAVAILABLE'}));return;
      }
      if (get().playbackLoading) { get().pause(); return; }
      if (get().currentTrack && !audio?.src) { get().playTrack(get().currentTrack); return; }
      const { isPlaying, currentTrack } = get();
      if (!currentTrack) return;

      if (isPlaying) {
        audio.pause();
        set({ isPlaying: false });
        connectPresenceService.notifyPause(currentTrack, audio.currentTime);
      } else {
        audio.play().then(() => {
          connectPresenceService.notifyResume(currentTrack, audio.currentTime);
        }).catch(err => {
          if (err.name === 'AbortError') return;
          console.error('Toggle play failed.', err);
          const message = err.message || 'Audio playback failed.';
          set({
            isPlaying: false,
            playbackError: message
          });
          reportPlaybackError(message);
        });
      }
    },

    pause: () => {
      if(get().playbackEngine==='spotify') {
        if(get().playbackLoading){++playbackGeneration;playbackAbort?.abort();stopSpotify();}
        else spotifyController?.pause()?.catch(()=>{});
        set({isPlaying:false,playbackLoading:false});return;
      }
      if (get().activePlatformEmbed) { get().closePlatformEmbed(); return; }
      ++playbackGeneration;
      playbackAbort?.abort();
      set({ playbackLoading: false });
      const { currentTrack } = get();
      if (audio) {
        audio.pause();
        if (currentTrack) {
          connectPresenceService.notifyPause(currentTrack, audio.currentTime);
        }
      }
      set({ isPlaying: false });
    },

    seek: (time) => {
      if(get().playbackEngine==='spotify'){spotifyController?.seek(time)?.catch(()=>{});set({progress:time});return;}
      const { currentTrack } = get();
      if (audio) {
        audio.currentTime = time;
        set({ progress: time });
        if (currentTrack) {
          connectPresenceService.notifySeek(currentTrack, time);
        }
      }
    },

    setVolume: (value) => {
      if (!Number.isFinite(value)) return;
      const rounded = Math.max(0, Math.min(1, value));
      spotifyController?.volume(rounded)?.catch(()=>{});
      if (audio) {
        audio.volume = rounded;
      }
      set({ volume: rounded });
      try { window.localStorage.setItem('noirsound.volume', String(rounded)); }
      catch { /* Keep playback usable when storage is denied. */ }
    },

    next: () => {
      const { queue, currentTrack, repeatMode } = get();
      if (queue.length === 0 || !currentTrack) return;

      const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
      let nextIndex = currentIndex + 1;

      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          // No more tracks: stop and reset
          stopSpotify();
          if (audio) audio.pause();
          set({ isPlaying: false, progress: 0 });
          connectPresenceService.notifyEnded();
          return;
        }
      }

      const nextTrack = queue[nextIndex];
      get().playTrack(nextTrack);
    },

    previous: () => {
      const { queue, currentTrack } = get();
      if (queue.length === 0 || !currentTrack) return;

      const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
      let prevIndex = currentIndex - 1;

      if (prevIndex < 0) {
        prevIndex = queue.length - 1; // Wrap around
      }

      const prevTrack = queue[prevIndex];
      get().playTrack(prevTrack);
    },

    addToQueue: (track) => {
      const canQueue = canStreamTrack(track);
      if (!canQueue) return;
      const { queue } = get();
      if (queue.some(t => t.id === track.id)) return;
      set({ queue: [...queue, track] });
    },

    addTracksToQueue: (tracks) => {
      const { queue } = get();
      const existingIds = new Set(queue.map((track) => track.id));
      const additions = (tracks || [])
        .filter(canStreamTrack)
        .filter((track) => !existingIds.has(track.id));
      if (additions.length > 0) set({ queue: [...queue, ...additions] });
    },

    playNext: (track) => {
      if (!canStreamTrack(track)) return;
      const { queue, currentTrack } = get();
      const withoutTrack = queue.filter((item) => item.id !== track.id);
      const currentIndex = currentTrack
        ? withoutTrack.findIndex((item) => item.id === currentTrack.id)
        : -1;
      const insertionIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
      const nextQueue = [...withoutTrack];
      nextQueue.splice(insertionIndex, 0, track);
      set({ queue: nextQueue });
    },

    removeFromQueue: (trackId) => {
      const { queue } = get();
      set({ queue: queue.filter(t => t.id !== trackId) });
    },

    moveQueueItem: (trackId, direction) => {
      const { queue } = get();
      const currentIndex = queue.findIndex((track) => track.id === trackId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= queue.length) return;
      const nextQueue = [...queue];
      [nextQueue[currentIndex], nextQueue[nextIndex]] = [nextQueue[nextIndex], nextQueue[currentIndex]];
      set({ queue: nextQueue });
    },

    setQueue: (newQueue, queueSource = null) => {
      const streamableQueue = newQueue.filter(canStreamTrack);
      set({ queue: streamableQueue, originalQueue: [...streamableQueue], queueSource });
    },

    toggleShuffle: () => {
      const { shuffle, queue, originalQueue, currentTrack } = get();
      const nextShuffle = !shuffle;

      if (nextShuffle) {
        const shuffled = [...queue].sort(() => Math.random() - 0.5);
        // Put the currently playing track first so shuffle doesn't disrupt play
        if (currentTrack) {
          const index = shuffled.findIndex(t => t.id === currentTrack.id);
          if (index > -1) {
            shuffled.splice(index, 1);
            shuffled.unshift(currentTrack);
          }
        }
        set({ shuffle: nextShuffle, queue: shuffled });
      } else {
        // Find if current track is in original queue, keep it as active queue
        set({ shuffle: nextShuffle, queue: [...originalQueue] });
      }
    },

    toggleRepeat: () => {
      const modes = ['none', 'all', 'one'];
      const { repeatMode } = get();
      const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length;
      set({ repeatMode: modes[nextIndex] });
    },

    handleEnded: () => {
      const { repeatMode, currentTrack } = get();
      if (repeatMode === 'one' && currentTrack) {
        get().playTrack(currentTrack);
      } else {
        get().next();
      }
    }
  };
});

// Reordering/shuffling the queue invalidates an in-flight next-track download.
usePlayerStore.subscribe((state,previous)=>{
  if(state.currentTrack!==previous.currentTrack||state.queue!==previous.queue||state.repeatMode!==previous.repeatMode||state.isPlaying!==previous.isPlaying||state.activePlatformEmbed!==previous.activePlatformEmbed)scheduleWarm();
});
useUserStore.subscribe((state,previous)=>{
  if(state.user?.id===previous.user?.id)return;
  ++playbackGeneration;playbackAbort?.abort();audio?.pause();audio?.removeAttribute?.('src');
  stopPlatformPlayback();releaseCachedSource();
  if(previous.authHydrated || previous.user)audioCache.clear();
  usePlayerStore.setState({currentTrack:null,queue:[],originalQueue:[],queueSource:null,activePlatformEmbed:null,playbackEngine:'audio',isPlaying:false,playbackLoading:false,progress:0,lyricsFullscreenOpen:false});
});
if(typeof window!=='undefined')window.addEventListener('noirsound:audio-cache-change',cancelWarm);
