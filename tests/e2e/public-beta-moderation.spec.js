import { test, expect } from '@playwright/test';
import { API_BASE, backendUp, loginApi, uploadTrackViaApi } from './_helpers';

// Report -> admin sees it -> admin hides track -> hidden content is gone.
test.describe('public beta · moderation', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — full-stack test skipped.');
  });

  test('admin can open the routed console overview', async ({ page }) => {
    const login = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: 'admin@noirsound.com', password: 'password123' },
    });
    expect(login.ok()).toBeTruthy();

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/overview$/);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('Pending reports', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Audit Logs', exact: true })).toBeVisible();
  });

  test('report then admin hide removes a track from public surfaces', async ({ playwright }) => {
    test.setTimeout(120_000);
    const artist = await playwright.request.newContext();
    await loginApi(artist, 'artist@noirsound.com');
    const { trackId } = await uploadTrackViaApi(artist, { title: `Mod ${Date.now()}` });

    // A listener reports the track.
    const listener = await playwright.request.newContext();
    await loginApi(listener, 'listener@noirsound.com');
    const report = await listener.post(`${API_BASE}/reports`, {
      data: { targetType: 'TRACK', targetId: trackId, reason: 'COPYRIGHT', details: 'e2e report' },
    });
    expect(report.ok()).toBeTruthy();

    // A non-admin cannot read the admin queue.
    const forbidden = await listener.get(`${API_BASE}/admin/reports`);
    expect(forbidden.status()).toBe(403);

    // Admin sees the report and hides the track.
    const admin = await playwright.request.newContext();
    await loginApi(admin, 'admin@noirsound.com');
    const reports = await admin.get(`${API_BASE}/admin/reports?status=OPEN`);
    expect(reports.ok()).toBeTruthy();
    expect((await reports.json()).data.some((r) => r.targetId === trackId)).toBeTruthy();

    const hide = await admin.post(`${API_BASE}/admin/tracks/${trackId}/hide`, { data: { reason: 'e2e' } });
    expect(hide.ok()).toBeTruthy();

    // Hidden track no longer streams and is out of the catalog.
    const stream = await admin.get(`${API_BASE}/tracks/${trackId}/stream`, { maxRedirects: 0 });
    expect(stream.status()).toBe(404);
    expect((await admin.get(`${API_BASE}/tracks/${trackId}`)).status()).toBe(404);
    const list = await admin.get(`${API_BASE}/tracks`);
    expect((await list.json()).data.some((t) => t.id === trackId)).toBeFalsy();

    // The action is in the audit log.
    const audit = await admin.get(`${API_BASE}/admin/audit-logs`);
    expect((await audit.json()).data.some((l) => l.action === 'TRACK_HIDE' && l.targetId === trackId)).toBeTruthy();

    await Promise.all([artist.dispose(), listener.dispose(), admin.dispose()]);
  });

  test('suspension revokes sessions and blocks login until unsuspended', async ({ playwright }) => {
    const user = await playwright.request.newContext();
    const admin = await playwright.request.newContext();
    const freshLogin = await playwright.request.newContext();
    const suffix = Date.now();
    const credentials = {
      email: `suspend_${suffix}@test.local`,
      password: 'Password123!',
      username: `suspend_${suffix}`,
      displayName: 'Suspend Test User',
    };

    expect((await user.post(`${API_BASE}/auth/register`, { data: credentials })).ok()).toBeTruthy();
    const userId = (await (await user.get(`${API_BASE}/auth/me`)).json()).user.id;
    expect(await loginApi(admin, 'admin@noirsound.com')).toBeTruthy();

    const suspend = await admin.post(`${API_BASE}/admin/users/${userId}/suspend`, {
      data: { reason: 'e2e suspension contract' },
    });
    expect(suspend.ok()).toBeTruthy();
    expect((await user.get(`${API_BASE}/auth/me`)).status()).toBe(401);
    expect(await loginApi(freshLogin, credentials.email, credentials.password)).toBeFalsy();

    const unsuspend = await admin.post(`${API_BASE}/admin/users/${userId}/unsuspend`, {
      data: { reason: 'e2e restore' },
    });
    expect(unsuspend.ok()).toBeTruthy();
    expect(await loginApi(freshLogin, credentials.email, credentials.password)).toBeTruthy();

    await Promise.all([user.dispose(), admin.dispose(), freshLogin.dispose()]);
  });
});
