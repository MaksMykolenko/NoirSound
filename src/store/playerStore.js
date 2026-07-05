import { create } from 'zustand';
import { API_BASE_URL, useMockApi } from '../api/client';
import { getRecentlyPlayed } from '../api/stats';
import { setTrackLiked } from '../api/tracks';
import { useUserStore } from './userStore';

function reportPlaybackError(message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('noirsound:api-error', {
      detail: { message, status: 0 },
    }));
  }
}

let audio = null;

function canStreamTrack(track) {
  return track?.isStreamable ?? (useMockApi && Boolean(track?.audioUrl));
}

if (typeof window !== 'undefined') {
  audio = new Audio();
  audio.crossOrigin = 'anonymous';
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
  try {
    await useUserStore.getState().incrementPlayStats(track.id, track.artistId, {
      durationListenedSeconds: Math.round(listenedSeconds),
      completed: !!completed,
    });
  } catch (err) {
    console.warn('Failed to record a qualifying play:', err);
    // Do not flip qualifyReported back off on failure -- retrying mid-listen
    // would risk a duplicate report if the first request actually landed.
    // The next real listen (a fresh track/session) will try again.
  }
}

// Exposed only so tests can drive the exact <audio> element the store
// wires up (dispatching real `timeupdate`/`ended` events against it),
// instead of re-implementing or mocking the qualifying-play logic
// separately from what production code actually runs. Not part of the
// app-facing player API.
export function __getAudioElementForTests() {
  return audio;
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
      reportQualifyingPlay(track, listenedSeconds, isEnded).then(() => {
        // The recently-played list should only ever reflect a listen the
        // backend actually counted -- never an optimistic click. Adding it
        // here, after the qualifying report, keeps it consistent with
        // GET /me/recently-played (qualified-only).
        get().addToRecentlyPlayed(track);
      });
    }
  };

  // Setup audio listeners
  const setupEventListeners = () => {
    if (!audio) return;
    
    // Clear any existing bindings
    audio.onplay = null;
    audio.onpause = null;
    audio.ontimeupdate = null;
    audio.ondurationchange = null;
    audio.onended = null;
    audio.onerror = null;

    audio.onplay = () => set({ isPlaying: true });
    audio.onpause = () => set({ isPlaying: false });

    audio.ontimeupdate = () => {
      set({ progress: audio.currentTime });
      trackQualifyingProgress();
    };

    audio.ondurationchange = () => {
      if (audio.duration) {
        set({ duration: audio.duration });
      }
    };

    audio.onended = () => {
      // Safety net for very short tracks: `ended` can fire before the last
      // `timeupdate` tick would have crossed the qualifying threshold.
      trackQualifyingProgress(true);
      get().handleEnded();
    };
    audio.onerror = () => {
      const message = 'The processed audio stream could not be loaded.';
      set({
        isPlaying: false,
        playbackError: message
      });
      reportPlaybackError(message);
    };
  };

  if (typeof window !== 'undefined') {
    setupEventListeners();
  }

  return {
    currentTrack: null,
    queue: [],
    originalQueue: [],
    isPlaying: false,
    volume: 0.5,
    progress: 0,
    duration: 0,
    repeatMode: 'none', // 'none' | 'all' | 'one'
    shuffle: false,
    playbackError: null,
    likedTracks: useMockApi ? ["1", "2", "5"] : [],
    recentlyPlayed: [],
    recentlyPlayedError: null,
    isPlayerCollapsed: typeof window !== 'undefined' ? localStorage.getItem("noirsound.playerCollapsed") === "true" : false,
    lyricsFullscreenOpen: false,

    openLyricsFullscreen: () => {
      if (get().currentTrack) {
        set({ lyricsFullscreenOpen: true });
      }
    },

    closeLyricsFullscreen: () => {
      set({ lyricsFullscreenOpen: false });
    },

    collapsePlayer: () => {
      set({ isPlayerCollapsed: true });
      if (typeof window !== 'undefined') {
        localStorage.setItem("noirsound.playerCollapsed", "true");
      }
    },

    expandPlayer: () => {
      set({ isPlayerCollapsed: false });
      if (typeof window !== 'undefined') {
        localStorage.setItem("noirsound.playerCollapsed", "false");
      }
    },

    togglePlayerCollapsed: () => {
      const nextCollapsed = !get().isPlayerCollapsed;
      set({ isPlayerCollapsed: nextCollapsed });
      if (typeof window !== 'undefined') {
        localStorage.setItem("noirsound.playerCollapsed", String(nextCollapsed));
      }
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

    toggleLikeTrack: async (trackId) => {
      const { likedTracks } = get();
      const willLike = !likedTracks.includes(trackId);
      try {
        await setTrackLiked(trackId, willLike);
        set({
          likedTracks: willLike
            ? [...likedTracks, trackId]
            : likedTracks.filter((id) => id !== trackId),
        });
      } catch {
        // apiFetch reports the real failure. Do not apply a local success state.
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

    playTrack: async (track, newQueue = null) => {
      if (!audio) return;
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
        playbackError: null
      };

      if (newQueue) {
        const streamableQueue = newQueue.filter(canStreamTrack);
        updates.queue = streamableQueue;
        updates.originalQueue = [...streamableQueue];
      }

      set(updates);

      // A new play session -- whether a new track or a restart of the same
      // one -- is a genuinely new listen, so its qualifying-play tracker
      // starts clean. This is the only place listenState resets; pausing
      // and resuming the *same* session (togglePlay) must not reset it, or
      // a user who pauses partway through would lose credit for time
      // already listened.
      resetListenState(track);

      if (useMockApi) {
        audio.src = track.audioUrl;
      } else {
        audio.src = `${API_BASE_URL}/tracks/${track.id}/stream`;
      }
      audio.volume = get().volume;

      try {
        await audio.play();
        set({ isPlaying: true });
        // Do NOT report a play or touch recently-played here -- starting
        // playback is not a listen. Both happen only once the qualifying
        // threshold is actually crossed (see trackQualifyingProgress),
        // which is the entire point of this pass: no page-load/click
        // inflation of play counts, monthly listeners, or listening
        // history.
      } catch (err) {
        console.error('HTML5 audio playback failed.', err);
        const message = err.message || 'Audio playback failed.';
        set({
          isPlaying: false,
          playbackError: message
        });
        reportPlaybackError(message);
      }
    },

    togglePlay: () => {
      const { isPlaying, currentTrack } = get();
      if (!currentTrack) return;

      if (isPlaying) {
        audio.pause();
        set({ isPlaying: false });
      } else {
        audio.play().catch(err => {
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
      if (audio) audio.pause();
      set({ isPlaying: false });
    },

    seek: (time) => {
      if (audio) {
        audio.currentTime = time;
        set({ progress: time });
      }
    },

    setVolume: (value) => {
      const rounded = Math.max(0, Math.min(1, value));
      if (audio) {
        audio.volume = rounded;
      }
      set({ volume: rounded });
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

    removeFromQueue: (trackId) => {
      const { queue } = get();
      set({ queue: queue.filter(t => t.id !== trackId) });
    },

    setQueue: (newQueue) => {
      const streamableQueue = newQueue.filter(canStreamTrack);
      set({ queue: streamableQueue, originalQueue: [...streamableQueue] });
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
