// Real API client handling generic fetch logic, credentials, and normalized errors.
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.status = status;
    this.data = data;
    // Stable machine-readable error code from the backend body (e.g.
    // 'CSRF_VALIDATION_FAILED', 'RATE_LIMITED'). Used to look up a friendly,
    // localized message at display time while `message` stays log-friendly.
    this.code = data && typeof data === 'object' ? (data.error || null) : null;
    this.name = 'ApiError';
  }
}

export function getGoogleAuthorizationUrl() {
  const returnTo = typeof window === 'undefined'
    ? '/'
    : `${window.location.pathname}${window.location.search}`;
  const url = new URL(`${API_BASE_URL}/auth/google`, window.location.origin);
  url.searchParams.set('returnTo', returnTo);
  return url.toString();
}

export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const {
    suppressErrorToast = false,
    ...fetchOptions
  } = options;
  
  const defaultHeaders = { ...fetchOptions.headers };
  const hasContentType = Object.keys(defaultHeaders)
    .some((header) => header.toLowerCase() === 'content-type');
  if (fetchOptions.body != null && !hasContentType) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: defaultHeaders,
      credentials: fetchOptions.credentials || 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Unauthorized API request.');
      }
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText || 'Unknown error' };
      }
      const apiError = new ApiError(
        errorData.error || errorData.message || 'API request failed',
        response.status,
        errorData
      );
      if (!suppressErrorToast) notifyApiError(apiError);
      throw apiError;
    }

    if (response.status === 204) return null;

    // Support non-JSON responses if specifically requested
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  } catch (err) {
    // Rethrow ApiErrors directly
    if (err instanceof ApiError) throw err;
    // Network or other fetch errors
    const apiError = new ApiError(err.message, 0);
    if (!suppressErrorToast) notifyApiError(apiError);
    throw apiError;
  }
}

export function notifyApiError(error) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('noirsound:api-error', {
      detail: {
        message: error.message,
        status: error.status,
        // Pass the stable code through so the UI can render a friendly,
        // localized message instead of the raw backend code.
        code: error.code ?? null
      }
    }));
  }
}

export { isMockMode, useMockApi } from './mode';
