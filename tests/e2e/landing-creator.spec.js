import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { API_BASE, backendUp, makeWavBuffer } from './_helpers.js';

const require = createRequire(import.meta.url);
const { createPrismaClient } = require('../../backend/src/lib/prisma.js');
const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
let prisma;

test.beforeAll(async ({ request }) => {
  const database = new URL(process.env.DATABASE_URL || 'http://invalid');
  expect(process.env.NODE_ENV).not.toBe('production');
  expect(process.env.COMPOSE_PROJECT_NAME).toMatch(/^noirsound-verify-[a-f0-9]{12}$/);
  expect(database.hostname).toBe('127.0.0.1');
  expect(database.pathname).toMatch(/_test$/);
  expect(new URL(API_BASE).hostname).toBe('127.0.0.1');
  expect(await backendUp(request)).toBe(true);
  prisma = createPrismaClient();
});
test.afterAll(async () => { await prisma?.$disconnect(); });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('noirsound_language', 'en'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function signInFromUpload(page, email) {
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Email address', { exact: true }).fill(email);
  await dialog.getByLabel('Password', { exact: true }).fill('password123');
  await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('guest preview preserves its File through sign-in and publishes through the existing pipeline with the authenticated owner', async ({ page }) => {
  test.setTimeout(150_000);
  const title = `Landing creator ${Date.now()}`;
  const fileName = `landing-${Date.now()}.wav`;
  const wav = makeWavBuffer(2);
  let uploadInitiations = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/uploads/track/init') uploadInitiations += 1;
  });
  await page.goto('/#create');
  await page.getByLabel('Choose your audio', { exact: true }).setInputFiles({ name: fileName, mimeType: 'audio/wav', buffer: wav });
  await page.getByLabel('Track title', { exact: true }).fill(title);
  await page.getByLabel('Artist name in preview', { exact: true }).fill('A different preview author');
  await page.getByRole('radio', { name: 'Beat', exact: true }).check();
  const preview = page.getByRole('button', { name: 'See preview', exact: true });
  await preview.click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(preview).toBeFocused();
  expect(uploadInitiations).toBe(0);
  expect(await prisma.track.count({ where: { title } })).toBe(0);

  await page.getByRole('button', { name: 'Continue to upload', exact: true }).click();
  await expect(page).toHaveURL(/\/upload$/);
  await signInFromUpload(page, 'artist@noirsound.com');
  await expect(page.getByLabel('Track Title', { exact: true })).toHaveValue(title);
  await expect(page.getByText(fileName, { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Beat', exact: true })).toBeChecked();
  expect(uploadInitiations).toBe(0);
  expect(await prisma.track.count({ where: { title } })).toBe(0);

  await page.getByLabel('Select track artwork', { exact: true }).setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });
  await page.getByRole('button', { name: 'Primary Genre', exact: true }).click();
  await page.getByRole('option', { name: 'Electronic', exact: true }).click();
  const submit = page.getByRole('button', { name: 'Submit track to processing', exact: true });
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('rights');
  expect(uploadInitiations).toBe(0);
  await page.getByRole('checkbox', { name: 'I confirm that I own the rights to this track or have permission to publish it.', exact: true }).check();
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Ready to Publish', exact: true })).toBeVisible({ timeout: 120_000 });
  expect(uploadInitiations).toBe(1);

  const me = await page.request.get(`${API_BASE}/auth/me`);
  expect(me.ok()).toBe(true);
  const ownerId = (await me.json()).user.id;
  const tracks = await prisma.track.findMany({ where: { title }, include: { artist: true, uploads: true } });
  expect(tracks).toHaveLength(1);
  const [track] = tracks;
  expect(track).toMatchObject({ status: 'PUBLISHED', contentType: 'BEAT', copyrightConfirmed: true, isPublic: true, fileSize: wav.length });
  expect(track.processedAudioKey).toBeTruthy();
  expect(track.artist.userId).toBe(ownerId);
  expect(track.primaryArtistName).not.toBe('A different preview author');
  expect(track.uploads).toHaveLength(1);
  expect(track.uploads[0]).toMatchObject({ userId: ownerId, originalFileName: fileName, sizeBytes: wav.length });
  expect(await prisma.playEvent.count({ where: { trackId: track.id } })).toBe(0);
  const publicTrack = await page.request.get(`${API_BASE}/tracks/${track.id}`);
  expect(publicTrack.ok()).toBe(true);
});

test('a listener receives the existing artist-access guidance, keeps the SPA draft and sees a notice after reload', async ({ page }) => {
  const title = `Landing listener ${Date.now()}`;
  const fileName = `listener-${Date.now()}.wav`;
  let uploadRequests = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/uploads/')) uploadRequests += 1;
  });
  await page.goto('/#create');
  await page.getByLabel('Track title', { exact: true }).fill(title);
  await page.getByLabel('Choose your audio', { exact: true }).setInputFiles({ name: fileName, mimeType: 'audio/wav', buffer: makeWavBuffer() });
  await page.getByRole('button', { name: 'Continue to upload', exact: true }).click();
  await signInFromUpload(page, 'listener@noirsound.com');
  await expect(page.getByRole('heading', { name: 'Creator access required', exact: true })).toBeVisible();
  expect(uploadRequests).toBe(0);
  expect(await prisma.track.count({ where: { title } })).toBe(0);
  await page.goBack();
  await expect(page.getByLabel('Track title', { exact: true })).toHaveValue(title);
  await expect(page.getByText(fileName, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('The previous local draft was cleared after a reload or sign-in redirect. Enter the details and choose your audio again.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Track title', { exact: true })).toHaveValue('');
  expect(uploadRequests).toBe(0);
});
