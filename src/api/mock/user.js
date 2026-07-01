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

export async function getCurrentUser() {
  return currentDemoUser;
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
  currentDemoUser = null;
  return { success: true };
}

export async function updateProfile(profileData) {
  currentDemoUser = { ...(currentDemoUser || demoUser), ...profileData };
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
