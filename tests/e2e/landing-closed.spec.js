import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { API_BASE, backendUp, loginApi, uploadTrackViaApi } from './_helpers.js';

const require = createRequire(import.meta.url);
const { createPrismaClient } = require('../../backend/src/lib/prisma.js');
let prisma;
const password = 'ClosedSmoke123!';
const unique = label => `${label}_${Date.now().toString(36)}`;
test.beforeAll(async ({ request }) => {
  expect(process.env.PUBLIC_APP_ENABLED).toBe('false');
  expect(process.env.VITE_PUBLIC_APP_ENABLED).toBe('false');
  expect(process.env.NODE_ENV).toBe('test');
  expect(process.env.COMPOSE_PROJECT_NAME).toMatch(/^noirsound-verify-[a-f0-9]{12}$/);
  const database = new URL(process.env.DATABASE_URL);
  expect(database.hostname).toBe('127.0.0.1');
  expect(database.pathname).toMatch(/^\/noirsound_[a-f0-9]{12}_api_test$/);
  expect(await backendUp(request)).toBe(true);
  prisma = createPrismaClient();
});
test.afterAll(async () => { await prisma?.$disconnect(); });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('noirsound_language', 'en'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function expectGate(ctx, path = '/tracks') {
  const response = await ctx.get(`${API_BASE}${path}`);
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe('PUBLIC_APP_NOT_ENABLED');
}
async function uiLogin(page, email, secret = password) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email address', { exact: true }).fill(email);
  await dialog.getByLabel('Password', { exact: true }).fill(secret);
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toBeHidden();
}

for (const creatorType of ['LISTENER', 'ARTIST', 'BEATMAKER', 'BOTH']) {
  test(`closed registration ${creatorType}: browser create, persistence, logout/login and relationships`, async ({ page }) => {
    const username = unique(creatorType.toLowerCase());
    const email = `${username}@example.test`;
    await page.goto('/');
    await page.getByRole('button', { name: /create account/i }).first().click();
    const dialog = page.getByRole('dialog');
    if (creatorType !== 'LISTENER') {
      await dialog.getByRole('tab', { name: 'Creator', exact: true }).click();
      await dialog.getByRole('button', { name: { ARTIST: 'Artist', BEATMAKER: 'Beatmaker', BOTH: 'Both' }[creatorType], exact: true }).click();
    }
    await dialog.locator('input[name="username"]').fill(username);
    await dialog.locator('input[name="displayName"]').fill(`Smoke ${creatorType}`);
    await dialog.getByLabel('Email address', { exact: true }).fill(email);
    await dialog.getByLabel('Password', { exact: true }).fill(password);
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toBeHidden();
    await page.reload();
    const me = await page.request.get(`${API_BASE}/auth/me`);
    expect(me.status()).toBe(200);
    const user = (await me.json()).user;
    expect(user.role).toBe('LISTENER');
    const stored = await prisma.user.findUnique({ where: { id: user.id }, include: { artistProfile: true, creatorRegistration: true } });
    expect(stored.email).toBe(email);
    if (creatorType === 'LISTENER') {
      expect(stored.artistProfile).toBeNull();
      expect(stored.creatorRegistration).toBeNull();
    } else {
      expect(stored.artistProfile.userId).toBe(user.id);
      expect(stored.creatorRegistration).toMatchObject({ creatorType, intendsMusic: creatorType !== 'BEATMAKER', intendsBeats: creatorType !== 'ARTIST' });
      expect(user.canUploadTracks).toBe(false);
    }
    for (const route of ['/discover', '/library', '/upload']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\?notice=coming-soon$/);
    }
    await expectGate(page.request);
    const logout = page.waitForResponse(response => response.url().endsWith('/api/auth/logout') && response.request().method() === 'POST');
    const userMenu = page.getByRole('button', { name: new RegExp(`@${username}`, 'i') });
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }
    await page.getByRole('menuitem', { name: /sign out/i }).or(page.getByRole('button', { name: /sign out/i })).first().click();
    expect((await logout).status()).toBe(200);
    expect((await page.request.get(`${API_BASE}/auth/me`)).status()).toBe(401);
    await uiLogin(page, email);
    await page.reload();
    expect((await page.request.get(`${API_BASE}/auth/me`)).status()).toBe(200);
  });
}

test('closed role matrix and supported admin logout revoke the full-app bypass', async ({ browser }) => {
  for (const email of [null, 'listener@noirsound.com', 'artist@noirsound.com', 'admin@noirsound.com']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'en'));
    if (email) expect(await loginApi(context.request, email)).toBe(true);
    await page.goto('/discover');
    if (email === 'admin@noirsound.com') {
      await expect(page).toHaveURL(/\/discover$/);
      expect((await context.request.get(`${API_BASE}/tracks`)).status()).toBe(200);
      await page.goto('/admin/creators');
      await expect(page.getByRole('heading', { name: /creator registrations/i })).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
      await page.goto('/discover');
      const cookies = await context.cookies(API_BASE);
      const sessionCookie = cookies.find(cookie => cookie.name === 'token');
      expect(sessionCookie).toBeTruthy();
      expect((await context.request.post(`${API_BASE}/auth/logout`)).status()).toBe(200);
      // Restore the still-signed cookie as an attacker retaining a revoked JWT would.
      await context.addCookies([sessionCookie]);
      expect((await context.request.get(`${API_BASE}/auth/me`)).status()).toBe(401);
      await expectGate(context.request);
      await page.reload();
      await expect(page).toHaveURL(/\?notice=coming-soon$/);
    } else {
      await expect(page).toHaveURL(/\?notice=coming-soon$/);
      for (const path of ['/tracks', '/discover', '/tracks/unknown/stream']) await expectGate(context.request, path);
      const stats = await context.request.get(`${API_BASE}/me/listening-stats`);
      expect(stats.status()).toBe(email ? 403 : 401);
    }
    await context.close();
  }
});

test('registration rejects invalid inputs, normalized duplicates and client privilege fields', async ({ playwright }) => {
  const context = await playwright.request.newContext();
  const username = unique('validation');
  const data = { username, email: `${username}@example.test`, displayName: 'Validation', password, accountType: 'LISTENER' };
  for (const change of [{ email: 'broken' }, { username: '..' }, { password: ' ' }, { accountType: 'CREATOR', creatorType: 'ADMIN' }]) {
    expect((await context.post(`${API_BASE}/auth/register`, { data: { ...data, ...change } })).status()).toBe(400);
  }
  const created = await context.post(`${API_BASE}/auth/register`, { data: { ...data, role: 'ADMIN', canUploadTracks: true } });
  expect(created.status()).toBe(200);
  expect((await created.json()).user).toMatchObject({ role: 'LISTENER', canUploadTracks: false });
  const duplicate = await context.post(`${API_BASE}/auth/register`, { data: { ...data, email: ` ${data.email.toUpperCase()} ` } });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).error).toBe('REGISTER_EMAIL_EXISTS');
  await context.dispose();
});

test('creator self and admin creator list/detail/export honor separate privacy boundaries', async ({ playwright }) => {
  const creator = await playwright.request.newContext();
  const username = unique('privacy');
  const registered = await creator.post(`${API_BASE}/auth/register`, { data: {
    username, email: `${username}@example.test`, displayName: 'Privacy creator', password,
    accountType: 'CREATOR', creatorType: 'ARTIST', intendsMusic: true, intendsBeats: false
  } });
  expect(registered.status()).toBe(200);
  const id = (await registered.json()).user.id;
  const registration = await prisma.creatorRegistration.update({ where: { userId: id }, data: { adminNote: 'PRIVATE_MODERATION_SENTINEL' } });
  const self = await creator.post(`${API_BASE}/auth/creator-onboarding`, { data: { creatorType: 'ARTIST', intendsMusic: true, intendsBeats: false } });
  expect(self.status()).toBe(200);
  expect(await self.text()).not.toContain('PRIVATE_MODERATION_SENTINEL');
  expect(await self.text()).not.toContain('adminNote');
  const admin = await playwright.request.newContext();
  expect(await loginApi(admin, 'admin@noirsound.com')).toBe(true);
  for (const path of [`/admin/creators?q=${username}`, `/admin/creators/${registration.id}`, '/admin/creators/export']) {
    const response = await admin.get(`${API_BASE}${path}`);
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain(`${username}@example.test`);
  }
  // The current ADMIN permission registry has no pii.read; positive DTO permission
  // behavior is tested at backend level without inventing a production super-role.
  await creator.dispose(); await admin.dispose();
});

test('closed landing plays processed public audio with Range/seek and rechecks hidden/private eligibility', async ({ page, playwright }) => {
  test.setTimeout(150000);
  const admin = await playwright.request.newContext();
  expect(await loginApi(admin, 'admin@noirsound.com')).toBe(true);
  const title = unique('Closed audio');
  const { trackId } = await uploadTrackViaApi(admin, { title });
  const media = `${API_BASE}/landing/tracks/${trackId}/stream`;
  const range = await page.request.get(media, { headers: { Range: 'bytes=0-1023' } });
  expect(range.status()).toBe(206);
  expect(range.headers()['accept-ranges']).toBe('bytes');
  expect(range.headers()['content-range']).toMatch(/^bytes 0-1023\//);
  await expectGate(page.request, `/tracks/${trackId}/stream`);
  await page.goto('/#listen');
  await page.getByTestId('landing-track').filter({ hasText: title }).click();
  await expect.poll(() => page.evaluate(async () => {
    const { __getAudioElementForTests } = await import('/src/store/playerStore.js');
    const audio = __getAudioElementForTests();
    return audio.currentTime > 0 && !audio.error;
  })).toBe(true);
  // Seek the singleton media element; verify the browser accepts the target.
  const seek = await page.evaluate(async () => {
    const { __getAudioElementForTests } = await import('/src/store/playerStore.js');
    const audio = __getAudioElementForTests();
    if (!audio || !Number.isFinite(audio.duration)) return false;
    audio.pause(); audio.currentTime = audio.duration * 0.5;
    return await new Promise(resolve => { audio.addEventListener('seeked', () => resolve(audio.currentTime > 0), { once: true }); setTimeout(() => resolve(false), 5000); });
  });
  expect(seek).toBe(true);
  await prisma.track.update({ where: { id: trackId }, data: { isPublic: false } });
  expect((await page.request.get(media)).status()).toBe(404);
  const showcase = await page.request.get(`${API_BASE}/landing/showcase`);
  expect(await showcase.text()).not.toContain(trackId);
  await prisma.track.update({ where: { id: trackId }, data: { isPublic: true } });
  const stored = await prisma.track.findUnique({ where: { id: trackId } });
  await prisma.artistProfile.update({ where: { id: stored.artistId }, data: { isHidden: true } });
  expect((await page.request.get(media)).status()).toBe(404);
  await prisma.artistProfile.update({ where: { id: stored.artistId }, data: { isHidden: false } });
  await admin.dispose();
});
