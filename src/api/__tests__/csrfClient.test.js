import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateProfile } from '../real/user';
import { ApiError } from '../client';

function jsonResponse({ ok, status, body }) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Forbidden',
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

describe('real API client · CSRF contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends mutating profile saves through the shared client, same-origin with credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, status: 200, body: { user: { id: '1', displayName: 'Neo' } } })
    );
    vi.stubGlobal('fetch', fetchMock);

    await updateProfile({ displayName: 'Neo' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/me$/);
    expect(opts.method).toBe('PUT');
    // credentials:'include' is what sends the auth cookie the CSRF guard checks.
    expect(opts.credentials).toBe('include');
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('surfaces a CSRF rejection as an ApiError carrying the stable code (not shown raw to users)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        ok: false,
        status: 403,
        body: {
          statusCode: 403,
          error: 'CSRF_VALIDATION_FAILED',
          message: 'Cross-origin state-changing request rejected.',
        },
      })
    ));

    const events = [];
    const handler = (e) => events.push(e.detail);
    window.addEventListener('noirsound:api-error', handler);

    const err = await updateProfile({ displayName: 'Neo' }).catch((e) => e);

    window.removeEventListener('noirsound:api-error', handler);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('CSRF_VALIDATION_FAILED');
    // The dispatched api-error event carries the code so the UI can localize it.
    expect(events.at(-1)).toMatchObject({ status: 403, code: 'CSRF_VALIDATION_FAILED' });
  });
});
