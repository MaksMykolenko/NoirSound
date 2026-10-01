import { create } from 'zustand';
import { resolveExternalPlayback, resolvePlatformEmbed, recordExternalPlay } from '../api/externalCatalog';
import { API_BASE_URL, useMockApi } from '../api/client';
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
let playbackGeneration = 0;
let playbackAbort = null;
let stopPlatformFrame = null;
export function registerPlatformFrameStop(stop) {
  stopPlatformFrame = stop;
  return () => { if (stopPlatformFrame === stop) stopPlatformFrame = null; };
}
function stopPlatformPlayback() { stopPlatformFrame?.(); stopPlatformFrame = null; }
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

    audio.onplay = () => { if (!get().activePlatformEmbed) set({ isPlaying: true }); };
    audio.onpause = () => set({ isPlaying: false });

    audio.ontimeupdate = () => {
      if (get().activePlatformEmbed) return;
      set({ progress: audio.currentTime });
      trackQualifyingProgress();
    };

    audio.ondurationchange = () => {
      if (get().activePlatformEmbed) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        set({ duration: audio.duration });
      }
    };

    audio.onended = () => {
      if (get().activePlatformEmbed) return;
      // Safety net for very short tracks: `ended` can fire before the last
      // `timeupdate` tick would have crossed the qualifying threshold.
      trackQualifyingProgress(true);
      get().handleEnded();
    };
    audio.onerror = () => {
      if (get().activePlatformEmbed) return;
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

    openPlatformEmbed: async (provider, url) => {
      const user = useUserStore.getState().user;
      if (user?.role !== 'ADMIN') throw new Error('EXTERNAL_BETA_FORBIDDEN');
      const generation = ++playbackGeneration;
      playbackAbort?.abort();
      playbackAbort = new AbortController();
      stopPlatformPlayback();
      audio?.pause();
      audio?.removeAttribute?.('src');
      set({activePlatformEmbed:null,currentTrack:null,isPlaying:false,progress:0,duration:0,playbackLoading:false,playbackError:null,lyricsFullscreenOpen:false});
      const embed = await resolvePlatformEmbed(provider, url, playbackAbort.signal);
      if (generation !== playbackGeneration || useUserStore.getState().user?.id !== user.id || useUserStore.getState().user?.role !== 'ADMIN') return;
      const origins = {SOUNDCLOUD:'https://w.soundcloud.com',APPLE_MUSIC:'https://embed.music.apple.com',YOUTUBE:'https://www.youtube-nocookie.com'};
      if (embed.playbackMode !== 'OFFICIAL_EMBED' || embed.provider !== provider || new URL(embed.embedUrl).origin !== origins[provider]) throw new Error('EXTERNAL_EMBED_UNSUPPORTED');
      set({activePlatformEmbed:{...embed,ownerId:user.id,generation},currentTrack:{id:`embed:${generation}`,title:provider,provider,playbackMode:'OFFICIAL_EMBED',isStreamable:false,hasLyrics:false},isPlayerCollapsed:false});
    },

    closePlatformEmbed: () => {
      ++playbackGeneration;
      playbackAbort?.abort();
      if (!get().activePlatformEmbed) return;
      stopPlatformPlayback();
      set({activePlatformEmbed:null,currentTrack:null,isPlaying:false,progress:0,duration:0,playbackLoading:false,lyricsFullscreenOpen:false});
    },

    playTrack: async (track, newQueue = null, queueSource = null) => {
      const generation = ++playbackGeneration;
      playbackAbort?.abort();
      playbackAbort = new AbortController();
      stopPlatformPlayback();
      set({activePlatformEmbed:null});
      ensureAudio();
      if (!audio) return;
      audio.pause();
      audio.removeAttribute?.('src');
      set({ isPlaying: false, playbackLoading: false });
      const canPlay = canStreamTrack(track);
      if (!canPlay) {
        const message = 'Audio is not available for this release yet.';
        set({ isPlaying: false, playbackError: message });
        reportPlaybackError(message);
        return;
      }

      const updates = {
        currentTrack: track,
        progress: 0,
        duration: track.duration || 0,
        playbackError: null,
        playbackLoading: track.playbackMode === 'EXTERNAL_STREAM'
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
        if (track.playbackMode === 'EXTERNAL_STREAM') {
          const resolved = await resolveExternalPlayback(track, playbackAbort.signal);
          if (generation !== playbackGeneration) return;
          if (resolved.playbackMode !== 'EXTERNAL_STREAM' || !resolved.url) throw new Error('External audio is unavailable.');
          audio.src = resolved.url;
        } else if (useMockApi) {
          audio.src = track.audioUrl;
        } else if (track.playbackSource === 'landing') {
          audio.src = `${API_BASE_URL}/landing/tracks/${encodeURIComponent(track.id)}/stream`;
        } else {
          audio.src = `${API_BASE_URL}/tracks/${encodeURIComponent(track.id)}/stream`;
        }
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
      if (get().activePlatformEmbed) return;
      if (get().playbackLoading) { get().pause(); return; }
      if (get().currentTrack?.playbackMode === 'EXTERNAL_STREAM' && !audio?.src) { get().playTrack(get().currentTrack); return; }
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
      if (get().activePlatformEmbed) return;
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
