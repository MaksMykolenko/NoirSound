export const demoUser = {
  id: 'demo-user',
  displayName: 'NoirSound Demo',
  username: 'demo_listener',
  avatarUrl: '/images/artist_avatar.png',
  bannerUrl: 'linear-gradient(135deg, #2a0812 0%, #090204 100%)',
  bio: 'Explicit demo-mode listener profile.',
  location: 'Demo environment',
  joinedAt: '2026',
  role: 'ADMIN',
};

let currentDemoUser = demoUser;
let demoBannerObjectUrl = null;

function revokeDemoBannerObjectUrl() {
  if (
    demoBannerObjectUrl
    && typeof URL !== 'undefined'
    && typeof URL.revokeObjectURL === 'function'
  ) {
    URL.revokeObjectURL(demoBannerObjectUrl);
  }
  demoBannerObjectUrl = null;
}

export async function getCurrentUser() {
  return currentDemoUser;
}

export async function getPublicProfile(username) {
  const profile = [currentDemoUser, demoUser]
    .find((candidate) => candidate?.username === username);
  if (profile) return { ...profile };
  const error = new Error('Profile not found');
  error.status = 404;
  throw error;
}

export async function login(email) {
  currentDemoUser = { ...demoUser, email };
  return { user: currentDemoUser };
}

export async function register(userData) {
  currentDemoUser = { ...demoUser, ...userData };
  return { user: currentDemoUser };
}

export async function logout() {
  revokeDemoBannerObjectUrl();
  currentDemoUser = null;
  return { success: true };
}

export async function updateProfile(profileData) {
  currentDemoUser = { ...(currentDemoUser || demoUser), ...profileData };
  return currentDemoUser;
}

export async function uploadProfileBanner(file, { onProgress } = {}) {
  revokeDemoBannerObjectUrl();
  demoBannerObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(file)
    : null;
  onProgress?.(100);
  currentDemoUser = {
    ...(currentDemoUser || demoUser),
    bannerUrl: demoBannerObjectUrl,
  };
  return currentDemoUser;
}

export async function removeProfileBanner() {
  revokeDemoBannerObjectUrl();
  currentDemoUser = {
    ...(currentDemoUser || demoUser),
    bannerUrl: null,
  };
  return currentDemoUser;
}

export async function ensureMyArtistProfile() {
  currentDemoUser = {
    ...(currentDemoUser || demoUser),
    hasArtistProfile: true,
    canUploadTracks: true,
    uploadAccessReason: null,
  };
  return currentDemoUser;
}
