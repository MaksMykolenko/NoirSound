import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPublicProfile,
  removeProfileBanner,
  uploadProfileBanner,
} from '../real/user';

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

function jsonErrorResponse(status, body) {
  return {
    ok: false,
    status,
    statusText: 'Request failed',
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

describe('public profile API client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('encodes the public username and unwraps the safe profile payload', async () => {
    const profile = { id: 'profile-1', username: 'night listener' };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ profile }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPublicProfile(profile.username)).resolves.toEqual(profile);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/profiles\/night%20listener$/);
    expect(options.credentials).toBe('include');
  });

  it('lets the public page own normal not-found feedback without a duplicate global toast', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonErrorResponse(404, { error: 'PROFILE_NOT_FOUND', message: 'Profile not found.' })
    ));
    const globalError = vi.fn();
    window.addEventListener('noirsound:api-error', globalError);

    await expect(getPublicProfile('missing')).rejects.toMatchObject({ status: 404 });
    expect(globalError).not.toHaveBeenCalled();
    window.removeEventListener('noirsound:api-error', globalError);
  });

  it('runs init, direct XHR PUT with progress, and complete before returning the user', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        uploadId: 'opaque-upload.png',
        uploadUrl: 'https://storage.test/signed-put',
      }))
      .mockResolvedValueOnce(jsonResponse({
        user: { id: 'profile-1', bannerUrl: 'https://storage.test/signed-get' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    let xhrInstance;
    class SuccessfulUploadRequest {
      constructor() {
        xhrInstance = this;
        this.listeners = {};
        this.uploadListeners = {};
        this.upload = {
          addEventListener: (type, listener) => {
            this.uploadListeners[type] = listener;
          },
        };
      }
      open(method, url) {
        this.method = method;
        this.url = url;
      }
      setRequestHeader(name, value) {
        this.header = [name, value];
      }
      addEventListener(type, listener) {
        this.listeners[type] = listener;
      }
      send(file) {
        this.file = file;
        this.uploadListeners.progress?.({ lengthComputable: true, loaded: 3, total: 4 });
        this.status = 200;
        this.listeners.load?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', SuccessfulUploadRequest);
    const progress = vi.fn();
    const file = new File(['real png bytes'], 'wide.png', { type: 'image/png' });

    await expect(uploadProfileBanner(file, { onProgress: progress })).resolves.toMatchObject({
      id: 'profile-1',
      bannerUrl: 'https://storage.test/signed-get',
    });

    expect(xhrInstance).toMatchObject({
      method: 'PUT',
      url: 'https://storage.test/signed-put',
      header: ['Content-Type', 'image/png'],
      file,
    });
    expect(progress).toHaveBeenNthCalledWith(1, 75);
    expect(progress).toHaveBeenLastCalledWith(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ fileName: 'wide.png', mimeType: 'image/png', fileSize: file.size }),
    });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ uploadId: 'opaque-upload.png' }),
    });
  });

  it('does not call complete after a failed storage PUT and removes via the managed endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        uploadId: 'opaque-upload.png',
        uploadUrl: 'https://storage.test/signed-put',
      }));
    vi.stubGlobal('fetch', fetchMock);
    class FailedUploadRequest {
      constructor() {
        this.listeners = {};
        this.upload = { addEventListener: vi.fn() };
      }
      open() {}
      setRequestHeader() {}
      addEventListener(type, listener) {
        this.listeners[type] = listener;
      }
      send() {
        this.status = 500;
        this.listeners.load?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FailedUploadRequest);
    const file = new File(['invalid'], 'wide.png', { type: 'image/png' });

    await expect(uploadProfileBanner(file)).rejects.toMatchObject({
      status: 500,
      code: 'PROFILE_BANNER_STORAGE_UNAVAILABLE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset().mockResolvedValueOnce(jsonResponse({
      user: { id: 'profile-1', bannerUrl: null },
    }));
    await expect(removeProfileBanner()).resolves.toMatchObject({ bannerUrl: null });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/me\/banner$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });
});
