import { test, expect } from '@playwright/test';
import { API_BASE, backendUp } from './_helpers';

// Full-stack: an authenticated settings save must succeed with CSRF protection
// ON, persist across reload, and NEVER surface the raw CSRF_VALIDATION_FAILED
// code to the user. Exercises two mutating endpoints: profile save (PUT
// /auth/me) and language preference (PUT /auth/me via the language switcher).
test.describe('public beta · settings save (CSRF enabled)', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — full-stack test skipped.');
  });

  test('save profile + language with no CSRF error and persistence across reload', async ({ page }) => {
    // Register a fresh account. page.request shares the cookie jar with the
    // page, so the SPA hydrates as the logged-in user on navigation.
    const suffix = Date.now();
    const email = `csrf_${suffix}@test.local`;
    const reg = await page.request.post(`${API_BASE}/auth/register`, {
      data: { email, password: 'Password123!', username: `csrf_${suffix}`, displayName: 'CSRF User' },
    });
    expect(reg.ok()).toBeTruthy();

    // Any leak of the raw backend code into the UI fails the test.
    const rawCsrf = page.getByText('CSRF_VALIDATION_FAILED', { exact: false });

    await page.goto('/profile?tab=settings');

    const displayName = page.locator('#settings-display-name');
    await expect(displayName).toBeVisible({ timeout: 10000 });

    const newName = `Renamed ${suffix}`;
    await displayName.fill(newName);

    // 1) Profile save (same-origin authenticated PUT /auth/me).
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(/saved successfully/i).first()).toBeVisible({ timeout: 8000 });
    await expect(rawCsrf).toHaveCount(0);

    // 2) Language preference change (another authenticated PUT /auth/me).
    const uk = page.getByRole('button', { name: 'Українська' });
    if (await uk.count()) {
      await uk.click();
      // UI switches to Ukrainian; still no CSRF code surfaced.
      await expect(page.getByText('Головна').first()).toBeVisible({ timeout: 8000 });
      await expect(rawCsrf).toHaveCount(0);
    }

    // 3) Persistence: reload and confirm the saved values round-tripped.
    await page.goto('/profile?tab=settings');
    await expect(page.locator('#settings-display-name')).toHaveValue(newName, { timeout: 10000 });
    await expect(page.getByText('CSRF_VALIDATION_FAILED', { exact: false })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('noirsound_language'))).toBe('uk');
  });
});
