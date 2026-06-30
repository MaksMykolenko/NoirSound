import { test, expect } from '@playwright/test';
import { API_BASE, backendUp } from './_helpers';

// Full-stack auth/session/CSRF/logout-revocation.
test.describe('public beta · auth & sessions', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — full-stack test skipped.');
  });

  test('register, hydrate, then logout revokes the session', async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const suffix = Date.now();
    const email = `e2e_${suffix}@test.local`;

    const reg = await ctx.post(`${API_BASE}/auth/register`, {
      data: { email, password: 'Password123!', username: `e2e_${suffix}`, displayName: 'E2E User' },
    });
    expect(reg.ok()).toBeTruthy();
    const setCookie = reg.headers()['set-cookie'] || '';
    expect(setCookie).toContain('HttpOnly');

    const me = await ctx.get(`${API_BASE}/auth/me`);
    expect(me.ok()).toBeTruthy();
    expect((await me.json()).user.email).toBe(email);

    const logout = await ctx.post(`${API_BASE}/auth/logout`);
    expect(logout.ok()).toBeTruthy();

    // After logout the session is revoked server-side.
    const meAfter = await ctx.get(`${API_BASE}/auth/me`);
    expect(meAfter.status()).toBe(401);
    await ctx.dispose();
  });

  test('rejects credentialed cross-origin POST (CSRF guard)', async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    await ctx.post(`${API_BASE}/auth/login`, { data: { email: 'listener@noirsound.com', password: 'password123' } });
    const res = await ctx.post(`${API_BASE}/auth/logout`, { headers: { origin: 'https://evil.example' } });
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });

  test('logout-all revokes every server-side session', async ({ playwright }) => {
    const first = await playwright.request.newContext();
    const second = await playwright.request.newContext();
    const suffix = Date.now();
    const credentials = {
      email: `logout_all_${suffix}@test.local`,
      password: 'Password123!',
      username: `logout_all_${suffix}`,
      displayName: 'Logout All User',
    };

    expect((await first.post(`${API_BASE}/auth/register`, { data: credentials })).ok()).toBeTruthy();
    expect((await second.post(`${API_BASE}/auth/login`, {
      data: { email: credentials.email, password: credentials.password },
    })).ok()).toBeTruthy();

    const logoutAll = await first.post(`${API_BASE}/auth/logout-all`);
    expect(logoutAll.ok()).toBeTruthy();
    expect((await first.get(`${API_BASE}/auth/me`)).status()).toBe(401);
    expect((await second.get(`${API_BASE}/auth/me`)).status()).toBe(401);
    await Promise.all([first.dispose(), second.dispose()]);
  });

  test('UI login works for a seeded user', async ({ page }) => {
    await page.goto('/');
    // Open auth modal (login entry point varies by layout; fall back to direct).
    const emailField = page.locator('input[name="email"]');
    if (!(await emailField.count())) {
      const signIn = page.getByRole('button', { name: /sign in|log in/i }).first();
      if (await signIn.count()) await signIn.click();
    }
    const form = page.locator('form').filter({
      has: page.locator('input[name="email"]'),
    }).first();
    await form.locator('input[name="email"]').fill('listener@noirsound.com');
    await form.locator('input[name="password"]').fill('password123');
    await form.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page.locator('input[name="password"]')).toHaveCount(0, { timeout: 8000 });
  });
});
