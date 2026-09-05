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

    const player = page.getByTestId('desktop-player');
    const openLyrics = player.getByRole('button', { name: 'Open fullscreen lyrics' });
    const standardPlayButton = player.getByTestId('standard-player-play-button');
    await expect(standardPlayButton).toBeVisible();
    await expect(openLyrics).toBeEnabled();
    await openLyrics.click();

    const fullscreen = page.getByTestId('fullscreen-lyrics-player');
    const standardBar = page.getByTestId('fullscreen-standard-desktop-playerbar');
    await expect(fullscreen).toBeVisible();
    await expect(fullscreen.getByText('City lights dissolve in rain')).toBeVisible();
    await expect(standardBar.getByTestId('standard-player-track-info')).toContainText('Nightcrawler');
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

  test('keeps controls reachable on mobile and disables unavailable lyrics', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await requireDemoMode(page);
    await page.getByRole('button', { name: 'Play track' }).click();
    const mobileLyricsButton = page.locator('button[aria-label="Open fullscreen lyrics"]:visible');
    await expect(mobileLyricsButton).toHaveCount(1);
    await mobileLyricsButton.click();

    const fullscreen = page.getByTestId('fullscreen-lyrics-player');
    const controls = page.getByTestId('fullscreen-standard-mobile-playerbar');
    await expect(fullscreen).toBeVisible();
    await expect(fullscreen.getByTestId('fullscreen-lyrics-back')).toBeVisible();
    await expect(controls.getByTestId('standard-player-track-info')).toContainText('Nightcrawler');
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
    const unavailableLyricsButton = page.locator('button[aria-label="Lyrics unavailable"]:visible');
    await expect(unavailableLyricsButton).toHaveCount(1);
    await expect(unavailableLyricsButton).toBeDisabled();
  });
});
