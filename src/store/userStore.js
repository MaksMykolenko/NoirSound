import { create } from 'zustand';
import { ApiError } from '../api/client';
import { isMockMode } from '../api/mode';
import {
  getCurrentUser,
  initialDemoUser,
  login,
  logout,
  removeProfileBanner,
  register,
  updateProfile,
  uploadProfileBanner,
} from '../api/user';
import { getListeningStats, recordPlayEvent } from '../api/stats';

function announceProfileChanged(user) {
  if (typeof window === 'undefined' || !user) return;
  window.dispatchEvent(new CustomEvent('noirsound:user-profile-changed', {
    detail: { id: user.id, username: user.username },
  }));
}

export const EMPTY_LISTENING_STATS = Object.freeze({
  totalListeningSeconds: 0,
  totalListeningMinutes: 0,
  tracksPlayed: 0,
  uniqueArtists: 0,
  topGenre: null,
  topTrackId: null,
  topGenres: [],
  topArtists: [],
  topTracks: [],
});

export const useUserStore = create((set) => ({
  user: initialDemoUser,
  authHydrated: isMockMode(),
  authError: null,
  isAuthModalOpen: false,
  setAuthModalOpen: (isOpen) => set({ isAuthModalOpen: isOpen }),

  userListeningStats: { ...EMPTY_LISTENING_STATS },
  listeningStatsHydrated: false,
  listeningStatsError: null,
  activity: [],

  fetchCurrentUser: async () => {
    try {
      const user = await getCurrentUser();
      set({ user, authHydrated: true, authError: null });
      if (user?.preferredLanguage && typeof window !== 'undefined') {
        const i18n = (await import('../i18n')).default;
        const saved = localStorage.getItem('noirsound_language');
        if (!saved && i18n.language !== user.preferredLanguage) {
          i18n.changeLanguage(user.preferredLanguage);
        }
      }
      return user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        set({ user: null, authHydrated: true, authError: null });
        return null;
      }
      set({
        user: null,
        authHydrated: true,
        authError: error.message || 'Could not verify your session.',
      });
      throw error;
    }
  },

  loginUser: async (email, password) => {
    const response = await login(email, password);
    const user = isMockMode()
      ? (response.user ?? response)
      : await getCurrentUser();
    set({ user, authHydrated: true, authError: null });
    return response;
  },

  registerUser: async (userData) => {
    const response = await register(userData);
    const user = isMockMode()
      ? (response.user ?? response)
      : await getCurrentUser();
    set({ user, authHydrated: true, authError: null });
    return response;
  },

  logoutUser: async () => {
    await logout();
    set({
      user: null,
      userListeningStats: { ...EMPTY_LISTENING_STATS },
      listeningStatsHydrated: false,
      activity: [],
    });
  },

  fetchListeningStats: async () => {
    try {
      const stats = await getListeningStats();
      set({
        userListeningStats: {
          ...EMPTY_LISTENING_STATS,
          ...stats,
          topGenres: stats?.topGenres || [],
          topArtists: stats?.topArtists || [],
          topTracks: stats?.topTracks || [],
        },
        listeningStatsHydrated: true,
        listeningStatsError: null,
      });
      return stats;
    } catch (error) {
      set({
        listeningStatsHydrated: true,
        listeningStatsError: error.message || 'Listening stats are unavailable.',
      });
      throw error;
    }
  },

  updateUser: async (updates) => {
    const user = await updateProfile(updates);
    set({ user });
    announceProfileChanged(user);
    return user;
  },

  uploadBanner: async (file, options) => {
    const user = await uploadProfileBanner(file, options);
    set({ user });
    announceProfileChanged(user);
    return user;
  },

  removeBanner: async () => {
    const user = await removeProfileBanner();
    set({ user });
    announceProfileChanged(user);
    return user;
  },

  addActivity: (type, text) => {
    if (!isMockMode()) return;
    set((state) => ({
      activity: [{
        id: `demo-activity-${Date.now()}`,
        type,
        text,
        timestamp: 'Just now',
      }, ...state.activity],
    }));
  },

  incrementPlayStats: async (
    trackId,
    _artistId,
    { durationListenedSeconds = 0, completed = false } = {}
  ) => {
    await recordPlayEvent(trackId, {
      durationListenedSeconds,
      completed,
      source: 'player',
    });
  },
}));
