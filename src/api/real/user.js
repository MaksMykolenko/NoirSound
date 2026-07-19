import { ApiError, apiFetch, notifyApiError } from '../client';

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

export async function getPublicProfile(username) {
  const response = await apiFetch(`/profiles/${encodeURIComponent(username)}`, {
    suppressErrorToast: true,
  });
  return response.profile ?? response.user ?? response;
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

function putProfileBanner(uploadUrl, file, onProgress) {
  if (typeof XMLHttpRequest === 'undefined') {
    return fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    }).then((response) => {
      if (!response.ok) {
        throw new ApiError(
          'Profile banner storage upload failed.',
          response.status,
          { error: 'PROFILE_BANNER_STORAGE_UNAVAILABLE' }
        );
      }
      onProgress?.(100);
    });
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', file.type);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new ApiError(
          'Profile banner storage upload failed.',
          request.status,
          { error: 'PROFILE_BANNER_STORAGE_UNAVAILABLE' }
        ));
      }
    });
    request.addEventListener('error', () => {
      reject(new ApiError(
        'Profile banner storage upload failed.',
        0,
        { error: 'PROFILE_BANNER_STORAGE_UNAVAILABLE' }
      ));
    });
    request.send(file);
  });
}

export async function uploadProfileBanner(file, { onProgress } = {}) {
  const init = await apiFetch('/auth/me/banner/init', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    }),
  });

  await putProfileBanner(init.uploadUrl, file, onProgress);
  const response = await apiFetch('/auth/me/banner/complete', {
    method: 'POST',
    body: JSON.stringify({ uploadId: init.uploadId }),
  });
  return response.user ?? response;
}

export async function removeProfileBanner() {
  const response = await apiFetch('/auth/me/banner', { method: 'DELETE' });
  return response.user ?? response;
}

// Narrow self-service: only ever succeeds for the signed-in user, and only
// when that user already has the ADMIN role (see backend/src/routes/auth.js).
// Not a general "become an artist" endpoint.
export async function ensureMyArtistProfile() {
  const response = await apiFetch('/auth/me/ensure-artist-profile', { method: 'POST' });
  return response.user ?? response;
}
