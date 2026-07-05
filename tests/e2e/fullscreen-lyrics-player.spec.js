import { expect, test } from '@playwright/test';

async function requireDemoMode(page) {
  await page.goto('/track/1');
  const demoBadge = page.getByText('Demo mode', { exact: true });
  test.skip(await demoBadge.count() === 0, 'Mock-mode fullscreen lyrics smoke test.');
}

test.describe('Fullscreen lyrics player — mock smoke', () => {
  test('opens as the viewport player and closes with Escape and browser Back', async ({ page }) => {
    await requireDemoMode(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('button', { name: 'Play track' }).click();

    const player = page.getByTestId('desktop-player');
    const openLyrics = player.getByRole('button', { name: 'Open fullscreen lyrics' });
    await expect(openLyrics).toBeEnabled();
    await openLyrics.click();

    const fullscreen = page.getByTestId('fullscreen-lyrics-player');
    await expect(fullscreen).toBeVisible();
    await expect(fullscreen.getByText('City lights dissolve in rain')).toBeVisible();
    await expect(fullscreen.getByRole('button', { name: 'Previous track' })).toBeVisible();
    await expect(fullscreen.getByRole('button', { name: 'Next track' })).toBeVisible();
    await expect(fullscreen.getByRole('slider', { name: 'Track progress' })).toBeVisible();
    await expect(page.locator('[inert]')).toHaveCount(1);
    await page.waitForTimeout(250);

    const geometry = await fullscreen.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(geometry).toMatchObject({
      left: 0,
      top: 0,
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    });

    await page.keyboard.press('Escape');
    await expect(fullscreen).toBeHidden();
    await expect(page).toHaveURL(/\/track\/1$/);

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
    const controls = page.getByTestId('fullscreen-lyrics-controls');
    await expect(fullscreen).toBeVisible();
    await expect(fullscreen.getByRole('button', { name: 'Close fullscreen lyrics' })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Previous track' })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Next track' })).toBeVisible();
    await expect(controls.getByRole('button', { name: /Play|Pause/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await fullscreen.getByRole('button', { name: 'Close fullscreen lyrics' }).click();
    await page.goto('/track/2');
    await page.getByRole('button', { name: 'Play track' }).click();
    const unavailableLyricsButton = page.locator('button[aria-label="Lyrics unavailable"]:visible');
    await expect(unavailableLyricsButton).toHaveCount(1);
    await expect(unavailableLyricsButton).toBeDisabled();
  });
});
