import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('noirsound_language', 'en');
    localStorage.setItem('noirsound.theme', 'noir-pink');
  });
});

test.describe('Discover content and interactions', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('All, Music, and Beats expose distinct useful information architecture', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.getByRole('heading', { level: 1, name: 'Discover' })).toBeVisible();
    for (const testId of [
      'discover-trending',
      'discover-trending-week',
      'discover-new-releases',
      'discover-fresh-beats',
      'discover-creators',
      'discover-genre-tiles',
      'discover-all-content',
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }

    await page.getByRole('tab', { name: 'Music', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Discover Music' })).toBeVisible();
    await expect(page.getByTestId('discover-new-releases')).toBeVisible();
    await expect(page.getByTestId('discover-genre-tiles')).toBeVisible();
    await expect(page.getByTestId('discover-fresh-beats')).toHaveCount(0);
    await expect(page.getByTestId('all-releases').getByTestId('beat-badge')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Beats', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Discover Beats' })).toBeVisible();
    for (const testId of [
      'beat-discover-filters',
      'discover-style-tiles',
      'discover-mood-tiles',
      'discover-creators',
      'discover-all-content',
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    await expect(page.getByTestId('discover-new-releases')).toHaveCount(0);
    await expect(page.getByTestId('discover-genre-tiles')).toHaveCount(0);
    await expect(page.getByTestId('beat-discover-filters').locator('select')).toHaveCount(0);

  });

  test('Beat dropdown keyboard state survives history and refresh', async ({ page }) => {
    await page.goto('/discover?content=BEAT');
    const bpm = page.getByTestId('beat-filter-bpm-trigger');
    await bpm.focus();
    await bpm.press('ArrowDown');
    await page.getByRole('option', { name: 'Any BPM', exact: true }).press('ArrowDown');
    await page.getByRole('option', { name: '< 90 BPM', exact: true }).press('ArrowDown');
    await page.getByRole('option', { name: '90–119 BPM', exact: true }).press('ArrowDown');
    await page.getByRole('option', { name: '120–149 BPM', exact: true }).press('Enter');
    await expect(page).toHaveURL(/bpm=120-149/);
    await expect(bpm).toBeFocused();

    const style = page.getByTestId('beat-filter-style-trigger');
    await style.click();
    await page.getByRole('option', { name: /^Trap/ }).click();
    await expect(page).toHaveURL(/style=Trap/);
    await expect(style).toBeFocused();

    await page.goBack();
    await expect(page).not.toHaveURL(/style=Trap/);
    await page.goForward();
    await expect(page).toHaveURL(/style=Trap/);
    await page.reload();
    await expect(page.getByTestId('beat-filter-bpm-trigger')).toContainText('120–149 BPM');
    await expect(page.getByTestId('beat-filter-style-trigger')).toContainText('Trap');
  });

  test('Beat rows preserve player, context menu, playlist, and producer actions', { tag: '@demo' }, async ({ page }) => {
    await page.goto('/discover?content=BEAT');
    const row = page.getByTestId('all-releases').locator('[data-track-id="5"]');
    await expect(row).toBeVisible();

    await row.hover();
    const playButton = row.getByRole('button', { name: 'Play Occult Shadows' });
    await expect(playButton).toBeVisible();
    await playButton.click();
    await expect(row).toHaveAttribute('aria-current', 'true');

    await row.click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /^(Play beat|Pause)$/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Add beat to playlist' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Go to producer' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Add beat to playlist' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add to playlist' });
    const playlistName = `Discover QA ${Date.now()}`;
    await dialog.getByLabel('New playlist').fill(playlistName);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(`Created “${playlistName}” and added the track.`)).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();

    await row.getByRole('link', { name: 'K-VLT', exact: true }).click();
    await expect(page).toHaveURL(/\/artist\/4$/);
  });
});

test.describe('Discover mobile filters and Beat metadata', () => {
  test('mobile Beat filters open and close with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/discover');
    await expect(page.getByRole('heading', { level: 1, name: 'Discover' })).toBeVisible();

    await page.getByRole('tab', { name: 'Beats', exact: true }).click();

    await page.getByTestId('beat-filter-bpm-trigger').click();
    const panel = page.getByTestId('beat-filter-bpm-trigger-panel');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

  });

  test('Beat detail exposes accurate metadata and contact information', { tag: '@demo' }, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/track/5');
    const hero = page.getByTestId('track-hero');
    await expect(hero).toHaveAttribute('data-is-beat', 'true');
    await expect(page.locator('.ns-beat-metadata-strip__item')).toHaveCount(4);
    for (const value of ['138', 'F# Minor', 'Dark', 'Memphis trap']) {
      await expect(page.getByTestId('beat-details').getByText(value, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'License / availability' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Usage / contact note' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const strip = page.locator('.ns-beat-metadata-strip');
    await expect(strip.locator('dt')).toHaveText(['BPM', 'Key', 'Mood', 'Style / type']);
    await expect(strip.locator('dd')).toHaveText(['138 BPM', 'F# Minor', 'Dark', 'Memphis trap']);
  });

});
