import { expect, test } from '@playwright/test';
import { makeWavBuffer } from './_helpers.js';

async function requireDemoMode(page) {
  await page.route('https://www.soundhelix.com/**', route => route.fulfill({
    status: 200, contentType: 'audio/wav', body: makeWavBuffer(90),
  }));
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

    await standardBar.getByRole('slider', { name: 'Track progress' }).fill('20');
    await expect(standardBar.getByRole('slider', { name: 'Track progress' })).toHaveValue('20');
    await standardBar.getByRole('slider', { name: 'Volume' }).fill('0.25');
    await expect(standardBar.getByRole('slider', { name: 'Volume' })).toHaveValue('0.25');
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

    await openLyrics.click();
    await expect(fullscreen).toBeVisible();
    await page.goBack();
    await expect(fullscreen).toBeHidden();
    await expect(page).toHaveURL(/\/track\/1$/);
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
