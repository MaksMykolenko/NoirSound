import { apiFetch, notifyApiError } from '../client';

export const demoUser = null;

export async function getCurrentUser() {
  try {
    const response = await apiFetch('/auth/me', { suppressErrorToast: true });
    return response.user ?? response;
  } catch (error) {
    if (error.status !== 401) notifyApiError(error);
    throw error;
  }
}

export async function login(email, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(userData) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function logout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export async function updateProfile(profileData) {
  const response = await apiFetch('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
  return response.user ?? response;
}
