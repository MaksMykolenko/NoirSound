import { expect, test } from '@playwright/test';
import { makeWavBuffer } from './_helpers.js';

const demoAudio = makeWavBuffer(90);

async function requireDemoMode(page) {
  await page.route('https://www.soundhelix.com/**', route => {
    const rangeHeader = route.request().headers().range;
    const range = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
    let start = 0;
    let end = demoAudio.length - 1;
    if (rangeHeader) {
      if (range?.[1]) {
        start = Number(range[1]);
        if (range[2]) end = Math.min(Number(range[2]), end);
      } else if (range?.[2]) {
        start = Math.max(0, demoAudio.length - Number(range[2]));
      }
      if (!range || (!range[1] && !range[2]) || !Number.isSafeInteger(start)
          || !Number.isSafeInteger(end) || start > end || start >= demoAudio.length) {
        return route.fulfill({
          status: 416,
          headers: { 'accept-ranges': 'bytes', 'content-range': `bytes */${demoAudio.length}`, 'content-length': '0' },
          body: '',
        });
      }
    }
    const body = demoAudio.subarray(start, end + 1);
    return route.fulfill({
      status: rangeHeader ? 206 : 200,
      contentType: 'audio/wav',
      headers: {
        'accept-ranges': 'bytes',
        'content-length': String(body.length),
        ...(rangeHeader ? { 'content-range': `bytes ${start}-${end}/${demoAudio.length}` } : {}),
      },
      body,
    });
  });
  await page.goto('/track/1');
  const demoBadge = page.getByTestId('demo-mode-indicator').filter({ visible: true }).first();
  await expect(demoBadge).toBeVisible();
}

test.describe('Fullscreen lyrics player — mock smoke', { tag: '@demo' }, () => {
  test('opens lyrics and closes with Escape and browser Back', async ({ page }) => {
    await requireDemoMode(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('button', { name: 'Play track' }).click();

    await page.getByRole('button', { name: 'Expand player', exact: true }).filter({ visible: true }).click();
    const player = page.getByTestId('desktop-player');
    const openLyrics = player.getByRole('button', { name: 'Open fullscreen player' });
    const standardPlayButton = player.getByTestId('standard-player-play-button');
    await expect(standardPlayButton).toBeVisible();
    await expect(openLyrics).toBeEnabled();
    await openLyrics.click();

    const fullscreen = page.getByTestId('fullscreen-lyrics-player');
    const standardBar = page.getByTestId('fullscreen-standard-desktop-playerbar');
    await expect(fullscreen).toBeVisible();
    await expect(fullscreen.getByText('City lights dissolve in rain')).toBeVisible();
    await expect(fullscreen.getByTestId('fullscreen-track-info')).toContainText('Nightcrawler');
    await expect(standardBar.getByTestId('standard-player-transport')).toBeVisible();
    await expect(standardBar.getByRole('button', { name: 'Previous track' })).toBeVisible();
    await expect(standardBar.getByRole('button', { name: 'Next track' })).toBeVisible();
    await expect(standardBar.getByRole('slider', { name: 'Track progress' })).toBeVisible();
    await expect(standardBar.getByRole('slider', { name: 'Volume' })).toBeVisible();
    const fullscreenPlayButton = standardBar.getByTestId('standard-player-play-button');
    await expect(fullscreenPlayButton).toBeVisible();
    await expect(
      standardBar.getByTestId('standard-player-actions').locator('button[aria-pressed="true"]')
    ).toHaveCount(1);
    await expect(page.locator('[inert]')).toHaveCount(1);

    const progress = standardBar.getByRole('slider', { name: 'Track progress' });
    await expect.poll(async () => Number(await progress.inputValue())).toBeGreaterThan(0);
    await expect(fullscreenPlayButton).toHaveAttribute('aria-label', 'Pause');
    await fullscreenPlayButton.click();
    await expect(fullscreenPlayButton).toHaveAttribute('aria-label', 'Play');
    await progress.fill('20');
    await expect(progress).toHaveValue('20');
    await standardBar.getByRole('slider', { name: 'Volume' }).fill('0.25');
    await expect(standardBar.getByRole('slider', { name: 'Volume' })).toHaveValue('0.25');
    await fullscreenPlayButton.click();
    await expect(fullscreenPlayButton).toHaveAttribute('aria-label', 'Pause');
    await expect.poll(async () => Number(await progress.inputValue())).toBeGreaterThan(20);
    await standardBar.getByRole('button', { name: 'Open play queue' }).click();
    await expect(fullscreen.getByRole('dialog', { name: 'Play Queue' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fullscreen.getByRole('dialog', { name: 'Play Queue' })).toBeHidden();
    await expect(fullscreen).toBeVisible();
    await page.waitForTimeout(250);

    await page.keyboard.press('Escape');
    await expect(fullscreen).toBeHidden();
    await expect(page).toHaveURL(/\/track\/1$/);
    await expect(openLyrics).toBeFocused();
    await expect(standardPlayButton).toHaveAttribute('aria-label', 'Pause');
    await expect.poll(async () => Number(await player.getByRole('slider', { name: 'Track progress' }).inputValue())).toBeGreaterThan(20);

    await openLyrics.click();
    await expect(fullscreen).toBeVisible();
    await page.goBack();
    await expect(fullscreen).toBeHidden();
    await expect(page).toHaveURL(/\/track\/1$/);
    await expect(standardPlayButton).toHaveAttribute('aria-label', 'Pause');
    await expect.poll(async () => Number(await player.getByRole('slider', { name: 'Track progress' }).inputValue())).toBeGreaterThan(20);
  });

  test('keeps controls reachable on mobile and opens tracks without lyrics', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await requireDemoMode(page);
    await page.getByRole('button', { name: 'Play track' }).click();
    await page.getByRole('button', { name: 'Expand player', exact: true }).filter({ visible: true }).click();
    const mobileLyricsButton = page.locator('button[aria-label="Open fullscreen player"]:visible');
    await expect(mobileLyricsButton).toHaveCount(1);
    await mobileLyricsButton.click();

    const fullscreen = page.getByTestId('fullscreen-lyrics-player');
    const controls = page.getByTestId('fullscreen-standard-mobile-playerbar');
    await expect(fullscreen).toBeVisible();
    await expect(fullscreen.getByTestId('fullscreen-lyrics-back')).toBeVisible();
    await expect(fullscreen.getByTestId('fullscreen-track-info')).toContainText('Nightcrawler');
    await expect(controls.getByTestId('standard-mobile-player-progress')).toBeVisible();
    await expect(controls.getByTestId('standard-mobile-player-transport')).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Previous track' })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Next track' })).toBeVisible();
    await expect(controls.getByRole('button', { name: /Play|Pause/ })).toBeVisible();

    await fullscreen.getByTestId('fullscreen-lyrics-back').click();
    await expect(fullscreen).toBeHidden();
    await expect(mobileLyricsButton).toBeFocused();
    await page.goto('/track/2');
    await page.getByRole('button', { name: 'Play track' }).click();
    const fullscreenButton = page.locator('button[aria-label="Open fullscreen player"]:visible');
    await expect(fullscreenButton).toBeEnabled();
    await fullscreenButton.click();
    await expect(fullscreen.getByText('Lyrics are not available for this track yet.')).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  });
});

for (const viewport of [{ width: 360, height: 800 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
  test(`immersive player fits ${viewport.width}×${viewport.height} and keeps controls visible @demo`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize(viewport);
    await requireDemoMode(page);
    await page.getByRole('button', { name: 'Play track', exact: true }).click();
    await page.getByRole('button', { name: 'Expand player', exact: true }).filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Open fullscreen player', exact: true }).filter({ visible: true }).click();
    const fullscreen = page.getByTestId('fullscreen-lyrics-player');
    const playButton = fullscreen.getByRole('button', { name: 'Pause', exact: true }).filter({ visible: true });
    await expect(playButton).toBeInViewport();
    await expect(fullscreen.getByTestId('fullscreen-lyrics-back')).toBeInViewport();
    await expect(fullscreen.locator('.ns-immersive-cover')).toBeInViewport();
    await expect(fullscreen.getByText('City lights dissolve in rain', { exact: false })).toBeVisible();
    await expect(fullscreen.getByTestId('fullscreen-artwork-backdrop').locator('img')).toHaveAttribute('data-loaded', 'true');
    await playButton.click();
    await expect(fullscreen.getByRole('button', { name: 'Play', exact: true }).filter({ visible: true })).toBeVisible();
    expect(await fullscreen.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const footer = fullscreen.getByTestId('fullscreen-lyrics-controls');
    await expect(footer).toBeInViewport();
    const footerBox = await footer.boundingBox();
    const coverBox = await fullscreen.locator('.ns-immersive-cover').boundingBox();
    const identity = fullscreen.getByTestId('fullscreen-track-info');
    await expect(identity).toBeInViewport();
    const identityBox = await identity.boundingBox();
    expect(identityBox.y).toBeGreaterThanOrEqual(coverBox.y + coverBox.height);
    expect(identityBox.y + identityBox.height).toBeLessThanOrEqual(footerBox.y);
    await expect(footer.getByTestId('standard-player-track-info')).toHaveCount(0);
    expect(Math.abs(footerBox.y + footerBox.height - viewport.height)).toBeLessThanOrEqual(1);
    expect(coverBox.y + coverBox.height).toBeLessThanOrEqual(footerBox.y);
    if (viewport.width >= 1024) {
      const controls = footer.getByTestId('fullscreen-standard-desktop-playerbar');
      await expect(controls.getByRole('slider', { name: 'Track progress' })).toBeInViewport();
      await expect(controls.getByRole('slider', { name: 'Volume' })).toBeInViewport();
    }
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    await expect(fullscreen).toHaveCSS('opacity', '1');
    await expect(fullscreen.getByTestId('fullscreen-artwork-backdrop').locator('img')).toHaveCSS('opacity', '0.72');
    await page.screenshot({ path: testInfo.outputPath('player.png') });
    await fullscreen.getByRole('button', { name: 'Open play queue' }).filter({ visible: true }).click();
    await expect(fullscreen.getByRole('dialog', { name: 'Play Queue' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fullscreen).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('timed lyrics follow seek, allow manual reading, and update on the next track @demo', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await requireDemoMode(page);
  // Fixture only: exercise the timed-lyrics API shape without publishing lyrics.
  await page.evaluate(async () => {
    const { cacheFullscreenLyrics } = await import('/src/components/player/fullscreenLyricsCache.js');
    cacheFullscreenLyrics('1', {
      trackId: '1', hasLyrics: true, lyricsType: 'SYNCED', lyricsText: '',
      lyricsSynced: Array.from({ length: 9 }, (_, index) => ({ time: index * 10, text: `Timed lyric line ${index + 1}` })),
    });
  });
  await page.getByRole('button', { name: 'Play Late Night Phonk', exact: true }).click();
  await page.getByRole('button', { name: 'Expand player', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Open fullscreen player', exact: true }).filter({ visible: true }).click();
  const fullscreen = page.getByTestId('fullscreen-lyrics-player');
  const controls = page.getByTestId('fullscreen-standard-desktop-playerbar');
  await controls.getByRole('button', { name: 'Pause', exact: true }).click();
  const seek = controls.getByRole('slider', { name: 'Track progress' });
  await seek.fill('31');
  await expect(fullscreen.getByRole('button', { name: 'Timed lyric line 4', exact: true })).toHaveAttribute('aria-current', 'true');
  await fullscreen.getByRole('button', { name: 'Timed lyric line 7', exact: true }).click();
  await expect(seek).toHaveValue('60');
  await expect(fullscreen.getByRole('button', { name: 'Timed lyric line 7', exact: true })).toHaveAttribute('aria-current', 'true');
  await fullscreen.getByTestId('fullscreen-lyrics-scroll').hover();
  await page.mouse.wheel(0, -300);
  await expect(fullscreen.getByRole('button', { name: 'Follow playback' })).toBeVisible();
  await fullscreen.getByRole('button', { name: 'Follow playback' }).click();
  await expect(fullscreen.getByRole('button', { name: 'Follow playback' })).toBeHidden();
  const activeColor = await fullscreen.getByRole('button', { name: 'Timed lyric line 7', exact: true }).evaluate(el => getComputedStyle(el).color);
  const inactiveColor = await fullscreen.getByRole('button', { name: 'Timed lyric line 6', exact: true }).evaluate(el => getComputedStyle(el).color);
  expect(activeColor).not.toBe(inactiveColor);
  await page.screenshot({ path: testInfo.outputPath('timed-lyrics.png') });
  expect(await fullscreen.getByTestId('fullscreen-artwork-backdrop').locator('img').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await controls.getByRole('button', { name: 'Next track', exact: true }).click();
  await expect(fullscreen).toBeVisible();
  await expect(fullscreen.getByText('Lyrics are not available for this track yet.')).toBeVisible();
  await expect(fullscreen.getByTestId('fullscreen-track-info')).not.toContainText('Nightcrawler');
});

test('missing artwork keeps the fullscreen player usable @demo', async ({ page }, testInfo) => {
  await page.route('**/images/cover_phonk.png', route => route.fulfill({ status: 404, body: '' }));
  await requireDemoMode(page);
  await page.getByRole('button', { name: 'Play track', exact: true }).click();
  await page.getByRole('button', { name: 'Expand player', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Open fullscreen player', exact: true }).filter({ visible: true }).click();
  const fullscreen = page.getByTestId('fullscreen-lyrics-player');
  await expect(fullscreen.locator('.ns-immersive-cover')).toHaveAttribute('role', 'img');
  await expect(fullscreen.getByTestId('fullscreen-artwork-backdrop').locator('img')).toHaveCount(0);
  await expect(fullscreen.getByRole('button', { name: 'Pause', exact: true }).filter({ visible: true })).toBeVisible();
  await expect(fullscreen).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('missing-cover.png') });
});
