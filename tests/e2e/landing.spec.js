import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { API_BASE, backendUp, makeWavBuffer } from './_helpers.js';

const require = createRequire(import.meta.url);
const { createPrismaClient } = require('../../backend/src/lib/prisma.js');
const { putObject } = require('../../backend/src/services/storage.js');
let prisma;
let fixture;

// These cases use the runner's isolated database, storage and actual stream
// endpoint. No API, audio or metadata responses are intercepted.
test.beforeAll(async ({ request }, testInfo) => {
  const database = new URL(process.env.DATABASE_URL || 'http://invalid');
  expect(['localhost', '127.0.0.1']).toContain(new URL(API_BASE).hostname);
  expect(['localhost', '127.0.0.1']).toContain(database.hostname);
  expect(database.pathname).toMatch(/_test$/);
  expect(process.env.NODE_ENV).not.toBe('production');
  expect(await backendUp(request)).toBe(true);
  prisma = createPrismaClient();
  const prefix = `landing-e2e-${Date.now()}-${testInfo.workerIndex}`;
  const audioKey = `${prefix}/stream.wav`;
  await putObject(audioKey, makeWavBuffer(120), 'audio/wav');
  await putObject(`${prefix}/not-audio.txt`, Buffer.from('not audio'), 'text/plain');
  const user = await prisma.user.create({ data: {
    email: `${prefix}@example.invalid`, username: prefix, displayName: `Original Artist ${prefix}`,
    role: 'ARTIST', status: 'ACTIVE',
    artistProfile: { create: { genres: ['electronic'] } },
  }, include: { artistProfile: true } });
  const hiddenUser = await prisma.user.create({ data: {
    email: `${prefix}-hidden@example.invalid`, username: `${prefix}-hidden`, displayName: 'Hidden artist fixture',
    role: 'ARTIST', status: 'ACTIVE',
    artistProfile: { create: { genres: ['electronic'], isHidden: true } },
  }, include: { artistProfile: true } });
  const suspendedUser = await prisma.user.create({ data: {
    email: `${prefix}-suspended@example.invalid`, username: `${prefix}-suspended`, displayName: 'Inactive artist fixture',
    role: 'ARTIST', status: 'SUSPENDED',
    artistProfile: { create: { genres: ['electronic'] } },
  }, include: { artistProfile: true } });
  const base = {
    artistId: user.artistProfile.id, tags: ['landing-e2e'], genre: 'electronic',
    status: 'PUBLISHED', isPublic: true, processedAudioKey: audioKey, duration: 120, durationSeconds: 120,
    publishedAt: new Date(), copyrightConfirmed: true,
  };
  const publicTracks = ['MUSIC', 'BEAT'].flatMap(contentType => Array.from({ length: 3 }, (_, index) => ({
    ...base, id: `${prefix}-${contentType}-${index}`, title: `${contentType} real recording ${index} ${prefix}`, contentType,
    ...(contentType === 'BEAT' ? { beatBpm: 138, beatKey: 'F# Minor', beatStyle: 'Trap' } : {}),
    lyricsType: 'PLAIN', lyricsText: 'Words from the real landing fixture.', lyricsRightsConfirmed: true,
  })));
  const excludedTracks = [
    { suffix: 'private', isPublic: false }, { suffix: 'hidden', status: 'HIDDEN' },
    { suffix: 'draft', status: 'DRAFT' }, { suffix: 'unprocessed', processedAudioKey: null },
    { suffix: 'missing', processedAudioKey: `${prefix}/missing.wav` },
    { suffix: 'not-audio', processedAudioKey: `${prefix}/not-audio.txt` },
    { suffix: 'hidden-artist', artistId: hiddenUser.artistProfile.id },
    { suffix: 'inactive-author', artistId: suspendedUser.artistProfile.id },
  ].map(({ suffix, ...overrides }) => ({ ...base, id: `${prefix}-excluded-${suffix}`, title: `Excluded ${suffix}`, contentType: 'MUSIC', ...overrides }));
  await prisma.track.createMany({ data: [...publicTracks, ...excludedTracks] });
  fixture = { publicTracks, excludedTracks, artistId: user.artistProfile.id, artistName: user.displayName };
});

test.afterAll(async () => { await prisma?.$disconnect(); });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Apply only on a new context; a reload must exercise actual persistence.
    if (!localStorage.getItem('noirsound_language')) localStorage.setItem('noirsound_language', 'en');
    if (!localStorage.getItem('noirsound.theme')) localStorage.setItem('noirsound.theme', 'light-minimal');
  });
});

const showcaseRows = page => page.getByTestId('landing-track');
const eventFilter = () => ({ trackId: { in: [...fixture.publicTracks, ...fixture.excludedTracks].map(track => track.id) } });

async function playbackState(page) {
  return page.evaluate(async () => {
    const { usePlayerStore } = await import('/src/store/playerStore.js');
    const state = usePlayerStore.getState();
    return {
      trackId: state.currentTrack?.id, queue: state.queue.map(track => track.id),
      originalQueue: state.originalQueue.map(track => track.id), queueSource: state.queueSource,
      progress: state.progress, volume: state.volume, shuffle: state.shuffle,
      repeatMode: state.repeatMode, isPlaying: state.isPlaying,
    };
  });
}

async function expectSharedAudio(page, audioHandle, previous) {
  expect(await page.evaluate(async audio => {
    const { __getAudioElementForTests } = await import('/src/store/playerStore.js');
    return __getAudioElementForTests() === audio && !audio.paused;
  }, audioHandle)).toBe(true);
  const current = await playbackState(page);
  expect(current).toMatchObject({ ...previous, progress: expect.any(Number), isPlaying: true });
  expect(current.progress).toBeGreaterThanOrEqual(previous.progress);
  return current;
}

test('public showcase exposes only real playable Music and Beats without streams or play events on passive interaction', async ({ page }) => {
  const streams = [];
  page.on('request', request => { if (/\/tracks\/[^/]+\/stream(?:\?|$)/.test(request.url())) streams.push(request.url()); });
  const eventsBefore = await prisma.playEvent.count({ where: eventFilter() });
  const showcaseResponse = page.waitForResponse(response => response.url().endsWith('/api/landing/showcase'));
  await page.goto('/?campaign=landing-functional');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yoursound.');
  const response = await showcaseResponse;
  expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  for (const type of ['MUSIC', 'BEAT']) {
    expect(data[type].map(track => track.id)).toEqual(fixture.publicTracks.filter(track => track.contentType === type).map(track => track.id));
    expect(data[type].every(track => track.contentType === type)).toBe(true);
  }
  await expect(showcaseRows(page)).toHaveCount(3);
  await showcaseRows(page).first().hover();
  await page.getByRole('tab', { name: 'Music', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Beats', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Beats', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await showcaseRows(page).evaluateAll(nodes => nodes.map(node => node.dataset.trackId))).toEqual(data.BEAT.map(track => track.id));
  await expect(page.getByRole('link', { name: 'Explore the beat catalog' })).toHaveAttribute('href', '/discover?content=BEAT');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Music', exact: true })).toBeFocused();
  expect(await showcaseRows(page).evaluateAll(nodes => nodes.map(node => node.dataset.trackId))).toEqual(data.MUSIC.map(track => track.id));
  await page.getByRole('heading', { name: /Start.*with one.*track/ }).scrollIntoViewIfNeeded();
  expect(streams).toEqual([]);
  expect((await playbackState(page)).trackId).toBeUndefined();
  expect(await prisma.playEvent.count({ where: eventFilter() })).toBe(eventsBefore);
  await expect(page.getByTestId('desktop-player')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
});

test('showcase playback survives landing, Discover, track and Home navigation with the same audio, queue and shared overlays', async ({ page }) => {
  test.setTimeout(60_000);
  const target = fixture.publicTracks.find(track => track.contentType === 'MUSIC');
  await page.goto('/');
  const targetRow = showcaseRows(page).filter({ hasText: target.title });
  await expect(targetRow).toHaveCount(1);
  await targetRow.click();
  const player = page.getByTestId('desktop-player');
  const playButton = player.getByTestId('standard-player-play-button');
  await expect(playButton).toHaveAttribute('aria-label', 'Pause');
  await expect.poll(async () => (await playbackState(page)).progress).toBeGreaterThan(0);
  await player.getByRole('slider', { name: 'Volume', exact: true }).fill('0.32');
  await player.getByRole('button', { name: /shuffle/i }).click();
  await player.getByRole('button', { name: /Change repeat mode/ }).click();
  const audio = await page.evaluateHandle(async () => (await import('/src/store/playerStore.js')).__getAudioElementForTests());
  let state = await playbackState(page);
  expect(state.trackId).toBe(target.id);
  expect(state.queue).toHaveLength(3);
  expect(state.volume).toBe(0.32);
  expect(state.shuffle).toBe(true);
  await page.getByRole('tab', { name: 'Beats', exact: true }).click();
  state = await expectSharedAudio(page, audio, state);
  await page.getByRole('link', { name: 'Explore the beat catalog' }).click();
  await expect(page).toHaveURL(/\/discover\?content=BEAT$/);
  await expect(page.getByTestId('discover-content-tabs').getByRole('tab', { name: 'Beats', exact: true })).toHaveAttribute('aria-selected', 'true');
  state = await expectSharedAudio(page, audio, state);
  await player.getByRole('link', { name: target.title, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: target.title })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/track/${target.id}$`));
  state = await expectSharedAudio(page, audio, state);
  await page.getByRole('link', { name: 'NoirSound home', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yoursound.');
  state = await expectSharedAudio(page, audio, state);

  const queueButton = player.getByRole('button', { name: 'Open play queue' });
  await queueButton.click();
  const queue = page.getByRole('dialog', { name: 'Play Queue' });
  await expect(queue).toBeVisible();
  await expect(queue.getByRole('button', { name: `Play ${target.title}`, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(queue).toBeHidden();
  await expect(queueButton).toBeFocused();
  const lyricsButton = player.getByRole('button', { name: 'Open fullscreen lyrics' });
  await lyricsButton.click();
  await expect(page.getByTestId('fullscreen-lyrics-player')).toBeVisible();
  await expect(page.getByText('Words from the real landing fixture.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('fullscreen-lyrics-player')).toBeHidden();
  await expect(lyricsButton).toBeFocused();
  state = await expectSharedAudio(page, audio, state);
  await page.getByRole('link', { name: 'Open NoirSound', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await page.getByRole('link', { name: 'Home', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByTestId('home-hero')).toBeVisible();
  await expectSharedAudio(page, audio, state);
  await playButton.click();
  await expect(playButton).toHaveAttribute('aria-label', 'Play');
  await audio.dispose();
});

test('mobile navigation traps and restores focus, and persisted motion preference follows live system reduction', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'NoirSound.' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press('Tab');
    expect(await menu.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await trigger.click();
  await menu.getByRole('link', { name: /^Listen/ }).click();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/\/#listen$/);
  await expect(page.getByRole('tab', { name: 'Music', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

  await page.getByRole('button', { name: 'Disable motion effects' }).click();
  await expect(page.getByRole('button', { name: 'Enable motion effects' })).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enable motion effects' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Enable motion effects' }).click();
  await expect(page.getByRole('button', { name: 'Disable motion effects' })).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Enable motion effects' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Enable motion effects' })).toHaveAttribute('aria-disabled', 'true');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Disable motion effects' })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 360, height: 800 });
  await trigger.click();
  await menu.getByRole('link', { name: 'Open NoirSound', exact: true }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('landing locale changes preserve authored titles and app theme, and metadata follows refreshed public deep links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light-minimal');
  await expect(showcaseRows(page)).toHaveCount(3);
  const titles = await showcaseRows(page).allTextContents();
  const language = page.getByRole('contentinfo').getByRole('combobox');
  for (const [locale, heading] of [['uk', 'Твоєзвучання.'], ['pl', 'Twojebrzmienie.'], ['ru', 'Твоёзвучание.'], ['en', 'Yoursound.']]) {
    await language.selectOption(locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    expect(await showcaseRows(page).allTextContents()).toEqual(titles);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light-minimal');
  }
  await expect(page).toHaveTitle('NoirSound — your sound');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://noirsound.co/');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await page.getByRole('link', { name: 'Explore the music catalog' }).click();
  await expect(page).toHaveURL(/\/discover\?content=MUSIC$/);
  await page.reload();
  await expect(page.getByTestId('discover-content-tabs').getByRole('tab', { name: 'Music', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://noirsound.co/discover');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light-minimal');
  const target = fixture.publicTracks[0];
  await page.goto(`/track/${target.id}?from=landing`);
  await expect(page.getByRole('heading', { level: 1, name: target.title })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://noirsound.co/track/${target.id}`);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'music.song');
  await page.goto(`/artist/${fixture.artistId}`);
  await expect(page.getByRole('heading', { level: 1, name: fixture.artistName })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://noirsound.co/artist/${fixture.artistId}`);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'profile');
  await page.getByRole('link', { name: 'NoirSound home', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveTitle('NoirSound — your sound');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
});
