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

export const usePlayerStore = create((set, get) => {
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
    
    audio.ontimeupdate = () => set({ progress: audio.currentTime });
    
    audio.ondurationchange = () => {
      if (audio.duration) {
        set({ duration: audio.duration });
      }
    };

    audio.onended = () => {
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

      if (useMockApi) {
        audio.src = track.audioUrl;
      } else {
        audio.src = `${API_BASE_URL}/tracks/${track.id}/stream`;
      }
      audio.volume = get().volume;

      try {
        await audio.play();
        set({ isPlaying: true });
        get().addToRecentlyPlayed(track);
        try {
          await useUserStore.getState().incrementPlayStats(track.id, track.artistId, {
            durationListenedSeconds: 0,
            completed: false
          });
        } catch (err) {
          console.warn("Failed to record playback start:", err);
        }
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
