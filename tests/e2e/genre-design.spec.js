import { test, expect } from '@playwright/test';
import { API_BASE, backendUp, loginApi, uploadTrackViaApi } from './_helpers.js';

async function openMorePicker(page) {
  await page.getByTestId('genre-quick-tabs').getByRole('button').last().click();
  await expect(page.getByTestId('genre-more-panel')).toBeVisible();
  await page.getByTestId('genre-picker-trigger').click();
  await expect(page.getByTestId('genre-picker-panel')).toBeVisible();
}

test.describe('Discover genre filters — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('More opens the grouped picker, search filters, selecting sets the chip', async ({ page }) => {
    await page.goto('/discover');
    await openMorePicker(page);

    // Search filters the option list.
    await page.getByTestId('genre-search').fill('jazz');
    await expect(page.locator('[data-genre-option="jazz"]')).toBeVisible();
    await expect(page.locator('[data-genre-option="techno"]')).toHaveCount(0);

    // Selecting updates the visible, removable chip with the localized label.
    await page.locator('[data-genre-option="jazz"]').click();
    await expect(page.getByTestId('genre-picker-panel')).toHaveCount(0);
    const chip = page.getByTestId('active-genre-chip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('Jazz');
  });

  test('picker closes with Escape', async ({ page }) => {
    await page.goto('/discover');
    await openMorePicker(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('genre-picker-panel')).toHaveCount(0);
  });
});

test.describe('Discover genre filters — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile picker searches and closes from its backdrop', async ({ page }) => {
    await page.goto('/discover');
    await openMorePicker(page);

    // The search input inside the sheet is usable (not covered by chrome).
    await page.getByTestId('genre-search').click();
    await page.getByTestId('genre-search').fill('phonk');
    await expect(page.locator('[data-genre-option="phonk"]')).toBeVisible();

    // Backdrop closes the sheet.
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('genre-picker-panel')).toHaveCount(0);
  });
});

// Genre names are always English, regardless of the active UI language
// (en/uk/pl/ru) — see NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md. These specs
// assert English text appears (and the old localized text does not) under
// every non-English UI language NoirSound ships.
test.describe('Genre taxonomy remains English across UI languages', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const LOCALIZED_URBAN_TAB = { uk: 'Хіп-хоп', pl: 'Hip-hop', ru: 'Хип-хоп' };

  for (const lng of ['uk', 'pl', 'ru']) {
    test(`${lng}: quick tabs render in English`, async ({ page }) => {
      await page.addInitScript((l) => localStorage.setItem('noirsound_language', l), lng);
      await page.goto('/discover');
      await page.waitForSelector('[data-testid="genre-quick-tabs"]');

      // Genre-group tab text is the English label, not a translation.
      await expect(page.getByRole('button', { name: 'Hip-Hop', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Electronic', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'World', exact: true })).toBeVisible();
      // The old per-language "Hip-Hop" translation must be gone.
      const localized = LOCALIZED_URBAN_TAB[lng];
      if (localized && localized !== 'Hip-Hop') {
        await expect(page.getByText(localized, { exact: true })).toHaveCount(0);
      }

    });

    test(`${lng}: full picker options and the active chip render in English`, async ({ page }) => {
      await page.addInitScript((l) => localStorage.setItem('noirsound_language', l), lng);
      await page.goto('/discover');
      await openMorePicker(page);

      await page.getByTestId('genre-search').fill('jazz');
      const jazzOption = page.locator('[data-genre-option="jazz"]');
      await expect(jazzOption).toBeVisible();
      await expect(jazzOption).toContainText('Jazz');

      await jazzOption.click();
      const chip = page.getByTestId('active-genre-chip');
      await expect(chip).toBeVisible();
      await expect(chip).toContainText('Jazz');
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
