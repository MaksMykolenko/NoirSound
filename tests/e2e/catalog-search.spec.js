import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { API_BASE, backendUp, makeWavBuffer } from './_helpers.js';

const require = createRequire(import.meta.url);
const { createPrismaClient } = require('../../backend/src/lib/prisma.js');
const { seedCatalogFixture } = require('../../backend/tests/fixtures/catalogFixture.js');
const { putObject } = require('../../backend/src/services/storage.js');
let prisma;
let fixture;
const diagnostics = new WeakMap();

// A genuine API/PostgreSQL/Redis/MinIO fixture. No catalogue or playback
// responses are intercepted by these scenarios, and missing services fail.
test.beforeAll(async ({ request }, testInfo) => {
  const api = new URL(API_BASE);
  const database = new URL(process.env.DATABASE_URL || 'http://invalid');
  expect(['localhost', '127.0.0.1']).toContain(api.hostname);
  expect(['localhost', '127.0.0.1']).toContain(database.hostname);
  expect(database.pathname).toMatch(/_test$/);
  expect(process.env.NODE_ENV).not.toBe('production');
  expect(await backendUp(request)).toBe(true);
  prisma = createPrismaClient();
  const prefix = `catalog-browser-${Date.now()}-w${testInfo.workerIndex}-${testInfo.project.name.includes('mobile') ? 'mobile' : 'desktop'}`;
  const audioKey = `${prefix}/shared.wav`;
  await test.step('Upload real fixture audio to isolated storage', () => putObject(audioKey, makeWavBuffer(20), 'audio/wav'));
  fixture = await test.step('Seed isolated 320-public-track catalogue', () => seedCatalogFixture(prisma, { prefix, processedAudioKey: audioKey }));
  const response = await request.get(`${API_BASE}/discover/catalog`, { params: { q: fixture.searchToken, limit: 30 } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ total: 320, pageInfo: { hasNextPage: true, pageSize: 30 } });
});

test.afterAll(async () => { await prisma?.$disconnect(); });

test.beforeEach(async ({ page }, testInfo) => {
  const events = [];
  diagnostics.set(page, events);
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) events.push({ event: 'navigation', url: frame.url() });
  });
  page.on('pageerror', error => events.push({ event: 'pageerror', message: error.message }));
  page.on('response', async response => {
    if (!response.url().includes('/api/discover/catalog')) return;
    const body = await response.json().catch(() => null);
    events.push({ event: 'catalog-response', url: response.url(), status: response.status(), total: body?.total, count: body?.items?.length });
  });
  await page.addInitScript(() => {
    localStorage.setItem('noirsound_language', 'en');
    localStorage.setItem('noirsound.theme', 'noir-pink');
  });
  const username = `catalog_${Date.now()}_${testInfo.workerIndex}`;
  const registration = await page.request.post(`${API_BASE}/auth/register`, {
    data: { email: `${username}@example.invalid`, username, displayName: 'Catalog browser listener', password: 'catalog-browser-password123', preferredLanguage: 'en' },
  });
  expect(registration.status()).toBe(200);
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  await testInfo.attach('catalog-network-state', {
    contentType: 'application/json',
    body: JSON.stringify({
      url: page.url(),
      draft: await page.getByTestId('discover-search').inputValue().catch(() => null),
      summary: await page.getByTestId('catalog-results-summary').textContent().catch(() => null),
      events: diagnostics.get(page),
    }, null, 2),
  });
});

const catalogue = page => page.getByTestId('all-releases');
const rows = page => catalogue(page).locator('[data-track-id]');
const summary = page => page.getByTestId('catalog-results-summary');
const queryUrl = (query, params = {}) => `/discover?${new URLSearchParams({ q: query, ...params })}`;
async function expectCount(page, shown, total) {
  await expect(rows(page)).toHaveCount(shown);
  await expect(summary(page)).toHaveText(`Showing ${shown} of ${total}`);
}
async function more(page, count, total = 320) {
  await page.getByRole('button', { name: 'Show more', exact: true }).click();
  await expectCount(page, count, total);
}
async function chooseFilter(page, testId, label) {
  await page.getByTestId(testId).click();
  await page.getByRole('option').filter({ has: page.getByText(label, { exact: true }) }).click();
}

test('searches beyond sixty records and restores server filters through detail, refresh and history', async ({ page }) => {
  test.setTimeout(90_000);
  const fixtureEvents = { trackId: { in: fixture.publicTracks.map(track => track.id) } };
  const eventCount = await prisma.playEvent.count({ where: fixtureEvents });
  await page.goto(queryUrl(fixture.searchToken));
  await expectCount(page, 30, 320);
  await more(page, 60);
  await more(page, 90);
  const loadedIds = await rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.trackId));
  expect(new Set(loadedIds).size).toBe(90);
  expect(await prisma.playEvent.count({ where: fixtureEvents })).toBe(eventCount);
  expect(loadedIds).not.toContain(fixture.lateMusicId);
  for (const track of fixture.hiddenTracks) expect(loadedIds).not.toContain(track.id);

  const target = fixture.publicTracks.find(track => track.id === fixture.lateMusicId);
  await page.getByTestId('discover-search').fill(target.title);
  await expectCount(page, 1, 1);
  await expect(page).toHaveURL(url => url.searchParams.get('q') === target.title);
  const targetRow = rows(page).filter({ has: page.getByRole('link', { name: target.title, exact: true }) });
  await targetRow.getByRole('link', { name: target.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/track/${target.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: target.title })).toBeVisible();
  await page.goBack();
  await expectCount(page, 1, 1);
  await expect(page.getByTestId('discover-search')).toHaveValue(target.title);
  await page.reload();
  await expectCount(page, 1, 1);

  await page.getByTestId('discover-search').fill(fixture.searchToken);
  await expectCount(page, 30, 320);
  await page.getByRole('tab', { name: 'Music', exact: true }).click();
  await expectCount(page, 30, 160);
  await expect(catalogue(page).getByTestId('beat-badge')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Beats', exact: true }).click();
  await expectCount(page, 30, 160);
  await expect(catalogue(page).getByTestId('beat-badge')).toHaveCount(30);
  await chooseFilter(page, 'beat-filter-style-trigger', 'Trap');
  await expectCount(page, 30, 80);
  await chooseFilter(page, 'beat-filter-bpm-trigger', '120–149 BPM');
  const filtered = fixture.publicTracks.filter(track => track.contentType === 'BEAT' && track.beatStyle === 'Trap' && track.beatBpm >= 120 && track.beatBpm <= 149);
  await expectCount(page, filtered.length, filtered.length);
  await page.reload();
  await expectCount(page, filtered.length, filtered.length);
  await page.goBack();
  await expect(page).not.toHaveURL(/bpm=/);
  await expectCount(page, 30, 80);
  await page.goForward();
  await expect(page).toHaveURL(/bpm=120-149/);
  await expectCount(page, filtered.length, filtered.length);
  await page.getByRole('tab', { name: 'Music', exact: true }).click();
  await expect(page).not.toHaveURL(/style=|mood=|bpm=|key=/);
  await expectCount(page, 30, 160);

  await page.goto(queryUrl(fixture.searchToken, { content: 'MUSIC', genre: 'jazz' }));
  await expectCount(page, 30, 80);
  const jazzIds = new Set(fixture.publicTracks.filter(track => track.contentType === 'MUSIC' && track.genre === 'jazz').map(track => track.id));
  for (const id of await rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.trackId))) expect(jazzIds.has(id)).toBe(true);
  await page.goto(queryUrl(`${fixture.searchToken} Hidden needle`));
  await expectCount(page, 0, 0);
  await expect(page.getByRole('button', { name: 'Show more', exact: true })).toHaveCount(0);
});

test('later-page playback, likes and playlist actions persist without pagination mutating the player', async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await page.goto(queryUrl(fixture.searchToken, { content: 'MUSIC' }));
  await expectCount(page, 30, 160);
  await more(page, 60, 160);
  await more(page, 90, 160);
  const lateRow = rows(page).nth(75);
  const trackId = await lateRow.getAttribute('data-track-id');
  const track = fixture.publicTracks.find(candidate => candidate.id === trackId);
  expect(track?.contentType).toBe('MUSIC');
  await lateRow.click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Play next', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Add to playlist', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await lateRow.getByRole('button', { name: `More actions for ${track.title}`, exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Add to playlist', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await lateRow.getByRole('button', { name: `Like ${track.title}`, exact: true }).click();
  await expect(lateRow.getByRole('button', { name: `Unlike ${track.title}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  const liked = await page.request.get(`${API_BASE}/me/liked-tracks`);
  expect(liked.ok()).toBe(true);
  expect((await liked.json()).data.some(item => item.id === trackId)).toBe(true);
  const playlistName = `Catalog playlist ${Date.now()}`;
  const created = await page.request.post(`${API_BASE}/playlists`, { data: { name: playlistName, isPublic: true } });
  expect(created.status()).toBe(201);
  const playlist = (await created.json()).playlist;
  await lateRow.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add to playlist', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add to playlist', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: new RegExp(playlistName) }).click();
  await expect(page.getByText(new RegExp(`Added .*${playlistName}`))).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  const persisted = await page.request.get(`${API_BASE}/playlists/${playlist.id}`);
  expect((await persisted.json()).playlist.tracks.some(entry => entry.track?.id === trackId)).toBe(true);

  const streamResponse = page.waitForResponse(response => response.url().includes(`/tracks/${trackId}/stream`) && [200, 206, 302].includes(response.status()));
  await lateRow.getByRole('button', { name: `Play ${track.title}`, exact: true }).click();
  await streamResponse;
  if (isMobile) {
    const player = page.getByRole('dialog', { name: `Now Playing: ${track.title}`, exact: true });
    await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await player.getByRole('button', { name: 'Collapse player', exact: true }).click();
  }
  await expect(lateRow).toHaveAttribute('aria-current', 'true');
  await expect(lateRow.getByRole('button', { name: `Pause ${track.title}`, exact: true })).toBeVisible();
  const progress = page.locator('input[aria-label="Track progress"]').first();
  await expect.poll(async () => Number(await progress.inputValue())).toBeGreaterThan(0.5);
  const positionBeforePagination = Number(await progress.inputValue());
  await more(page, 120, 160);
  await expect(page.locator(`[data-track-id="${trackId}"][aria-current="true"]`).first()).toBeVisible();
  await expect(catalogue(page).getByRole('button', { name: `Pause ${track.title}`, exact: true })).toBeVisible();
  expect(Number(await progress.inputValue())).toBeGreaterThanOrEqual(positionBeforePagination);

  await page.goto(`/playlist/${playlist.id}`);
  await expect(page.getByRole('heading', { level: 1, name: playlistName })).toBeVisible();
  await expect(page.locator(`[data-track-id="${trackId}"]`).filter({ visible: true }).first()).toBeVisible();
});
