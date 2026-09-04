import { test, expect } from '@playwright/test';
import { API_BASE, backendUp, loginApi, uploadTrackViaApi } from './_helpers.js';

// Own a worker-processed MUSIC fixture: another test may legitimately put a
// Beat or an item without waveform data first in the public catalogue.
async function openPublishedMusicTrack(page, playwright) {
  const artist = await playwright.request.newContext();
  try {
    expect(await backendUp(artist)).toBe(true);
    expect(await loginApi(artist, 'artist@noirsound.com')).toBe(true);
    const title = `Track detail E2E ${Date.now()}`;
    const { trackId } = await uploadTrackViaApi(artist, { title, contentType: 'MUSIC' });
    const published = await artist.get(`${API_BASE}/tracks/${trackId}`);
    expect(published.ok()).toBe(true);
    await page.goto(`/discover?content=MUSIC&q=${encodeURIComponent(title)}`);
    await page.getByTestId('all-releases').locator(`[data-track-id="${trackId}"]`).getByRole('link', { name: title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/track/${trackId}$`));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  } finally {
    await artist.dispose();
  }
}

test.describe('Track Page — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('reports missing or unavailable tracks', async ({ page }) => {
    await page.goto('/track/__nonexistent__');
    await page.waitForSelector('main');
    await expect(page.getByRole('heading', { name: /Track not found|Track unavailable/ })).toBeVisible();

  });

  test('real track hero, waveform and discussion', async ({ page, playwright }) => {
    test.setTimeout(120_000);
    await openPublishedMusicTrack(page, playwright);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Play track|Pause track|Audio unavailable/ })).toBeVisible();
    await expect(page.getByText('Waveform')).toBeVisible();
    await expect(page.getByText('Join the discussion')).toBeVisible();

  });
});

test.describe('Track Page — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('reports missing tracks on mobile', async ({ page }) => {
    await page.goto('/track/__nonexistent__');
    await page.waitForSelector('main');
    await expect(page.getByRole('heading', { name: /Track not found|Track unavailable/ })).toBeVisible();

  });

  test('real track mobile smoke', async ({ page, playwright }) => {
    test.setTimeout(120_000);
    await openPublishedMusicTrack(page, playwright);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Play track|Pause track|Audio unavailable/ })).toBeVisible();

    // Content is not hidden behind the bottom nav/player: the discussion heading
    // can be scrolled into view and becomes visible.
    const discussion = page.getByText('Join the discussion');
    await discussion.scrollIntoViewIfNeeded();
    await expect(discussion).toBeVisible();

  });
});

test.describe('Track Page — i18n', () => {
  test('localized error state in Ukrainian', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'uk'));
    await page.goto('/track/__nonexistent__');
    await expect(page.getByText(/Трек не знайдено|Трек недоступний/)).toBeVisible();
  });

});
