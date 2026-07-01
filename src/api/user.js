import * as userApi from '#api-mode/user.js';

export const getCurrentUser = (...args) => userApi.getCurrentUser(...args);
export const login = (...args) => userApi.login(...args);
export const register = (...args) => userApi.register(...args);
export const logout = (...args) => userApi.logout(...args);
export const updateProfile = (...args) => userApi.updateProfile(...args);
export const ensureMyArtistProfile = (...args) => userApi.ensureMyArtistProfile(...args);
export const initialDemoUser = userApi.demoUser ?? null;
