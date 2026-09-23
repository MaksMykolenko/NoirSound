import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fixtureTracks, fixtureUser, installFinalDesignFixtures } from './_interactionFixtures';

async function installPreferences(page) {
  const fixtures = await installFinalDesignFixtures(page);
  const liked = new Set();
  let user = { ...fixtureUser, avatarUrl: null };
  const avatar = readFileSync(new URL('../../public/images/artist_avatar.png', import.meta.url));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.route('**/api/auth/me', route => {
    if (route.request().method() === 'PUT') user = { ...user, ...route.request().postDataJSON() };
    return route.fulfill({ json: { user } });
  });
  await page.route('**/api/me/liked-tracks*', route => route.fulfill({ json: { data: fixtureTracks.filter(track => liked.has(track.id)) } }));
  await page.route('**/api/tracks/*/like', route => {
    const id = new URL(route.request().url()).pathname.split('/')[3];
    if (route.request().method() === 'POST') liked.add(id);
    else liked.delete(id);
    return route.fulfill({ json: { success: true } });
  });
  await page.route('**/api/auth/me/avatar', route => {
    expect(route.request().headers()['content-type']).toBe('image/jpeg');
    expect(route.request().postDataBuffer().length).toBe(avatar.length);
    user = { ...user, avatarUrl: '/api/public/avatars/qa-user/saved.webp' };
    return route.fulfill({ json: { user } });
  });
  await page.route('**/api/public/avatars/**', route => route.fulfill({ contentType: 'image/jpeg', body: avatar }));
  return { liked, errors, fixtures, avatar };
}

test('Space pauses from the page; saved likes and volume survive a full reload', async ({ page }) => {
  const { liked, errors, fixtures } = await installPreferences(page);
  await page.goto('/track/qa-track-1');
  await expect(page).toHaveTitle(/NoirSound/i);
  await expect(page.locator('main')).toContainText(fixtureTracks[0].title);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play track', exact: true }).click();
  const player = page.getByTestId('desktop-player');
  const play = player.getByTestId('standard-player-play-button');
  await expect(play).toHaveAttribute('aria-label', 'Pause');
  await page.locator('main h1').click();
  await page.keyboard.press('Space');
  await expect(play).toHaveAttribute('aria-label', 'Play');
  await page.keyboard.press('Space');
  await expect(play).toHaveAttribute('aria-label', 'Pause');
  const search = page.getByRole('searchbox').filter({ visible: true }).first();
  if (await search.count()) {
    await search.fill('test');
    await search.press('Space');
    await expect(search).toHaveValue('test ');
    await expect(play).toHaveAttribute('aria-label', 'Pause');
    await search.fill('');
  }
  await player.getByRole('slider', { name: 'Volume', exact: true }).fill('0.23');
  await page.locator('main').getByRole('button', { name: 'Like', exact: true }).click();
  await expect(page.locator('main').getByRole('button', { name: 'Unlike', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('main').getByRole('button', { name: 'Unlike', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Play track', exact: true }).click();
  await expect(player.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('0.23');
  await page.locator('main').getByRole('button', { name: 'Unlike', exact: true }).click();
  await expect.poll(() => liked.size).toBe(0);
  await page.goto('/track/qa-track-2');
  await page.locator('main').getByRole('button', { name: 'Like', exact: true }).click();
  await page.reload();
  await expect(page.locator('main').getByRole('button', { name: 'Unlike', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Play beat', exact: true }).click();
  await expect(player.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('0.23');
  if (process.env.E2E_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, 'saved-like-volume.png') });
  expect(fixtures.unknown).toEqual([]);
  expect(errors).toEqual([]);
});

test('avatar selection, save and reload work on desktop and mobile', async ({ page }) => {
  const { avatar, errors, fixtures } = await installPreferences(page);
  await page.goto('/profile?tab=settings');
  await expect(page).toHaveURL(/\/profile\?tab=settings$/);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  const photo = page.getByRole('img', { name: 'Profile photo preview', exact: true });
  await page.getByLabel('Choose a profile photo').setInputFiles({ name: 'avatar.jpg', mimeType: 'image/jpeg', buffer: avatar });
  await expect(photo).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: /^Save changes$/i }).click();
  await expect(photo).toHaveAttribute('src', '/api/public/avatars/qa-user/saved.webp');
  await page.reload();
  await expect(photo).toHaveAttribute('src', '/api/public/avatars/qa-user/saved.webp');
  await page.locator('section[aria-labelledby="profile-avatar-heading"]').evaluate(element => element.scrollIntoView({ block: 'center' }));
  if (process.env.E2E_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, 'avatar-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await photo.scrollIntoViewIfNeeded();
  await expect(photo).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace photo', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.E2E_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, 'avatar-mobile.png') });
  expect(fixtures.unknown).toEqual([]);
  expect(errors).toEqual([]);
});
