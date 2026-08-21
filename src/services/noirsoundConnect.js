import { sendPresenceEvent } from '../api/desktopConnect';
import { useUserStore } from '../store/userStore';

class NoirSoundConnectPresenceService {
  constructor() {
    this.sequence = 0;
    this.currentTrackId = null;
    this.isPlaying = false;
    this.lastPositionMs = 0;
    this.heartbeatTimer = null;
    this.seekDebounceTimer = null;
    this.HEARTBEAT_INTERVAL_MS = 20000; // 20 seconds
    this.SEEK_DEBOUNCE_MS = 300;

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.handleUnload());
      window.addEventListener('pagehide', () => this.handleUnload());
    }
  }

  nextSequence() {
    this.sequence += 1;
    return this.sequence;
  }

  canSendPresence() {
    const user = useUserStore.getState().user;
    return Boolean(user && user.id);
  }

  startHeartbeat(track) {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isPlaying && this.currentTrackId && this.canSendPresence()) {
        this.emitEvent('heartbeat', track?.id || this.currentTrackId, this.lastPositionMs);
      }
    }, this.HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref?.();
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async emitEvent(event, trackId, positionMs = 0, { keepalive = false } = {}) {
    if (!this.canSendPresence()) return;

    this.lastPositionMs = Math.max(0, Math.round(positionMs));
    const payload = {
      version: 1,
      event,
      trackId: trackId || this.currentTrackId,
      positionMs: this.lastPositionMs,
      clientSequence: this.nextSequence(),
      occurredAt: new Date().toISOString()
    };

    try {
      await sendPresenceEvent(payload, { keepalive });
    } catch {
      // Audio playback must never be interrupted by presence errors
    }
  }

  notifyPlay(track, positionSeconds = 0) {
    if (!track) return;
    this.currentTrackId = track.id;
    this.isPlaying = true;
    const positionMs = Math.round((positionSeconds || 0) * 1000);
    this.emitEvent('play', track.id, positionMs);
    this.startHeartbeat(track);
  }

  notifyResume(track, positionSeconds = 0) {
    if (!track && !this.currentTrackId) return;
    this.isPlaying = true;
    const trackId = track?.id || this.currentTrackId;
    const positionMs = Math.round((positionSeconds || 0) * 1000);
    this.emitEvent('resume', trackId, positionMs);
    this.startHeartbeat(track);
  }

  notifyPause(track, positionSeconds = 0) {
    this.isPlaying = false;
    this.stopHeartbeat();
    const trackId = track?.id || this.currentTrackId;
    const positionMs = Math.round((positionSeconds || 0) * 1000);
    this.emitEvent('pause', trackId, positionMs);
  }

  notifySeek(track, positionSeconds = 0) {
    const trackId = track?.id || this.currentTrackId;
    const positionMs = Math.round((positionSeconds || 0) * 1000);
    this.lastPositionMs = positionMs;

    if (this.seekDebounceTimer) {
      clearTimeout(this.seekDebounceTimer);
    }

    this.seekDebounceTimer = setTimeout(() => {
      this.emitEvent('seek', trackId, positionMs);
    }, this.SEEK_DEBOUNCE_MS);
  }

  notifyEnded() {
    this.isPlaying = false;
    this.stopHeartbeat();
    this.emitEvent('ended', this.currentTrackId, this.lastPositionMs);
    this.currentTrackId = null;
  }

  notifyStop() {
    this.isPlaying = false;
    this.stopHeartbeat();
    this.emitEvent('stop', this.currentTrackId, this.lastPositionMs);
    this.currentTrackId = null;
  }

  handleUnload() {
    if (this.isPlaying && this.currentTrackId && this.canSendPresence()) {
      this.emitEvent('stop', this.currentTrackId, this.lastPositionMs, { keepalive: true });
    }
  }
}

export const connectPresenceService = new NoirSoundConnectPresenceService();
export default connectPresenceService;
