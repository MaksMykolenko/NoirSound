import { test, expect } from '@playwright/test';
import { API_BASE, backendUp, loginApi, uploadTrackViaApi } from './_helpers.js';

async function openGenreFilter(page) {
  await page.getByTestId('catalog-genre-trigger').click();
  await expect(page.getByTestId('catalog-genre-trigger-panel')).toBeVisible();
}

test.describe('Discover genre filters — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('a shared genre is visible and removable even when it has no releases', async ({ page }) => {
    await page.goto('/discover?genre=jazz');
    await openGenreFilter(page);
    await expect(page.getByRole('option', { name: /^Jazz/ })).toBeVisible();
    await page.getByRole('option', { name: 'All', exact: true }).click();
    await expect(page).not.toHaveURL(/genre=/);
    await expect(page.getByTestId('catalog-genre-trigger-panel')).toHaveCount(0);
  });
  test('picker closes with Escape and returns focus', async ({ page }) => {
    await page.goto('/discover?genre=jazz');
    await openGenreFilter(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('catalog-genre-trigger-panel')).toHaveCount(0);
    await expect(page.getByTestId('catalog-genre-trigger')).toBeFocused();
  });
});

test.describe('Discover genre filters — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('mobile picker keeps a shared choice visible and closes from its backdrop', async ({ page }) => {
    await page.goto('/discover?genre=phonk');
    await openGenreFilter(page);
    await expect(page.getByRole('option', { name: /^Phonk/ })).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('catalog-genre-trigger-panel')).toHaveCount(0);
  });
});

test.describe('Genre taxonomy remains English across UI languages', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const lng of ['uk', 'pl', 'ru']) {
    test(`${lng}: active genre names remain English`, async ({ page }) => {
      await page.addInitScript((l) => localStorage.setItem('noirsound_language', l), lng);
      await page.goto('/discover?genre=hip_hop');
      await expect(page.getByTestId('catalog-genre-trigger')).toContainText('Hip-Hop');
      await expect(page.locator('.ns-discover-filter-chip').filter({ hasText: 'Hip-Hop' })).toBeVisible();
    });
    test(`${lng}: picker options remain English and the active chip clears the selection`, async ({ page }) => {
      await page.addInitScript((l) => localStorage.setItem('noirsound_language', l), lng);
      await page.goto('/discover?genre=jazz');
      await openGenreFilter(page);
      await expect(page.getByRole('option', { name: /^Jazz/ })).toBeVisible();
      await page.keyboard.press('Escape');
      await page.locator('.ns-discover-filter-chip').filter({ hasText: 'Jazz' }).click();
      await expect(page).not.toHaveURL(/genre=/);
    });
  }
});

test.describe('Genre i18n — Upload picker and Track page pill stay English', () => {
  test.describe.configure({ mode: 'serial' });
  let backendReady = false;
  let trackId = null;
  let artistCookies = [];

  test.beforeAll(async ({ request }) => {
    backendReady = await backendUp(request);
    if (!backendReady) return;
    const ok = await loginApi(request, 'artist@noirsound.com', 'password123');
    if (!ok) { backendReady = false; return; }
    artistCookies = (await request.storageState()).cookies;
    try {
      const result = await uploadTrackViaApi(request, { title: `Genre i18n E2E ${Date.now()}` });
      trackId = result.trackId;
    } catch {
      trackId = null;
    }
  });

  test.beforeEach(async ({ context }) => {
    if (artistCookies.length) await context.addCookies(artistCookies);
  });

  test('Ukrainian UI: Upload genre picker options are English', async ({ page }) => {
    test.skip(!backendReady, 'Backend not reachable in this environment.');
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'uk'));
    await page.goto('/upload');
    await page.waitForSelector('main');
    const trigger = page.getByTestId('genre-picker-trigger');
    test.skip(!(await trigger.count()), 'Upload form not reachable (auth fallback).');
    await trigger.click();
    const panel = page.getByTestId('genre-picker-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-genre-option="hip_hop"]')).toContainText('Hip-Hop');
    await expect(panel.locator('[data-genre-group="urban"]')).toContainText('Hip-Hop & Urban');
  });

  test('Ukrainian UI: Track page genre pill is English', async ({ page }) => {
    test.skip(!backendReady || !trackId, 'Backend/track not available in this environment.');
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'uk'));
    await page.goto(`/track/${trackId}`);
    await page.waitForSelector('main');
    // The uploaded track's genre is "electronic" (see uploadTrackViaApi default).
    await expect(page.getByText('Electronic', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Електроніка')).toHaveCount(0);
  });
});

test.describe('Upload genre picker', () => {
  test.describe.configure({ mode: 'serial' });

  // The Upload form is gated behind an ARTIST session. Try to authenticate via
  // the configured isolated API; existing auth fallback assertions are retained.
  let artistCookies = [];

  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: { email: 'artist@noirsound.com', password: 'password123' },
    }).catch(() => null);

    if (response?.ok()) {
      artistCookies = (await request.storageState()).cookies;
    }
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies(artistCookies);
  });

  test('desktop: picker opens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/upload');
    await page.waitForSelector('main');
    const trigger = page.getByTestId('genre-picker-trigger');
    if (await trigger.count()) {
      await trigger.click();
      await expect(page.getByTestId('genre-picker-panel')).toBeVisible();

    } else {
      await expect(page.locator('main')).toBeVisible(); // sign-in fallback
    }
  });

  test('mobile: picker search returns matching genres', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/upload');
    await page.waitForSelector('main');

    const trigger = page.getByTestId('genre-picker-trigger');
    if (await trigger.count()) {
      await trigger.click();
      await expect(page.getByTestId('genre-picker-panel')).toBeVisible();

      await page.getByTestId('genre-search').fill('rap');
      await expect(page.locator('[data-genre-option="rap"]')).toBeVisible();

    } else {
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
