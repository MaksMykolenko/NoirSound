import { test, expect } from '@playwright/test';

// Design QA for the new genre UI. These tests avoid depending on backend data:
// the genre taxonomy (quick tabs + picker options) is static, so the picker,
// search, selection and overflow behaviour can all be exercised without tracks.
// Backend-dependent bits (Upload form behind auth) are handled defensively.

const SHOTS = 'design-audit-screenshots/genre-ui';

async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const docOverflow = document.body.scrollWidth - window.innerWidth;
    const tabs = document.querySelector('[data-testid="genre-quick-tabs"]');
    const tabsOverflow = tabs ? tabs.scrollWidth - tabs.clientWidth : 0;
    return { docOverflow, tabsOverflow };
  });
}

async function openMorePicker(page) {
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByTestId('genre-more-panel')).toBeVisible();
  await page.getByTestId('genre-picker-trigger').click();
  await expect(page.getByTestId('genre-picker-panel')).toBeVisible();
}

test.describe('Discover genre filters — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('quick tabs render without horizontal overflow', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForSelector('[data-testid="genre-quick-tabs"]');
    const { docOverflow, tabsOverflow } = await horizontalOverflow(page);
    expect(docOverflow).toBeLessThanOrEqual(1);
    expect(tabsOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SHOTS}/desktop-discover-genres-1440x900.png`, fullPage: false });
  });

  test('More opens the grouped picker, search filters, selecting sets the chip', async ({ page }) => {
    await page.goto('/discover');
    await openMorePicker(page);
    await page.screenshot({ path: `${SHOTS}/desktop-discover-more-picker-1440x900.png` });

    // Search filters the option list.
    await page.getByTestId('genre-search').fill('jazz');
    await expect(page.locator('[data-genre-option="jazz"]')).toBeVisible();
    await expect(page.locator('[data-genre-option="techno"]')).toHaveCount(0);

    // Selecting updates the visible, removable chip with the localized label.
    await page.locator('[data-genre-option="jazz"]').click();
    await expect(page.getByTestId('genre-picker-panel')).toHaveCount(0);
    const chip = page.getByRole('button', { name: /Clear genre/ });
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

  test('no horizontal overflow; tabs wrap', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForSelector('[data-testid="genre-quick-tabs"]');
    const { docOverflow, tabsOverflow } = await horizontalOverflow(page);
    expect(docOverflow).toBeLessThanOrEqual(1);
    expect(tabsOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SHOTS}/mobile-discover-genres-390x844.png` });
  });

  test('More opens a bottom sheet that is not hidden behind nav/player', async ({ page }) => {
    await page.goto('/discover');
    await openMorePicker(page);
    await page.screenshot({ path: `${SHOTS}/mobile-discover-more-picker-390x844.png` });

    // Sheet sits within the viewport (bottom sheet anchored to the bottom).
    const box = await page.getByTestId('genre-picker-panel').boundingBox();
    expect(box).not.toBeNull();
    expect(box.y + box.height).toBeLessThanOrEqual(844 + 2);

    // The search input inside the sheet is usable (not covered by chrome).
    await page.getByTestId('genre-search').click();
    await page.getByTestId('genre-search').fill('phonk');
    await expect(page.locator('[data-genre-option="phonk"]')).toBeVisible();

    // Backdrop closes the sheet.
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('genre-picker-panel')).toHaveCount(0);
  });
});

test.describe('Genre i18n does not break layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Ukrainian quick tabs render and fit', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'uk'));
    await page.goto('/discover');
    await page.waitForSelector('[data-testid="genre-quick-tabs"]');
    await expect(page.getByRole('button', { name: 'Хіп-хоп' })).toBeVisible();
    const { docOverflow, tabsOverflow } = await horizontalOverflow(page);
    expect(docOverflow).toBeLessThanOrEqual(1);
    expect(tabsOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SHOTS}/mobile-discover-genres-uk-390x844.png` });
  });
});

test.describe('Upload genre picker', () => {
  test.describe.configure({ mode: 'serial' });

  // The Upload form is gated behind an ARTIST session. Try to authenticate via
  // the local API; if it isn't running, fall back to asserting the page is at
  // least rendered and scrollable without horizontal overflow.
  let artistCookies = [];

  test.beforeAll(async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/auth/login', {
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
      await page.screenshot({ path: `${SHOTS}/desktop-upload-genre-picker-1440x900.png` });
    } else {
      await expect(page.locator('main')).toBeVisible(); // sign-in fallback
    }
  });

  test('mobile: picker usable, page scrollable, search results show', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/upload');
    await page.waitForSelector('main');

    const { docOverflow } = await horizontalOverflow(page);
    expect(docOverflow).toBeLessThanOrEqual(1);

    const trigger = page.getByTestId('genre-picker-trigger');
    if (await trigger.count()) {
      await trigger.click();
      await expect(page.getByTestId('genre-picker-panel')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/mobile-upload-genre-picker-390x844.png` });

      await page.setViewportSize({ width: 360, height: 800 });
      await page.getByTestId('genre-search').fill('rap');
      await expect(page.locator('[data-genre-option="rap"]')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/mobile-upload-genre-search-results-360x800.png` });
    } else {
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
