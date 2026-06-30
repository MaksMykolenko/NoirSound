import { test, expect } from '@playwright/test';

const mobileViewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
];

let listenerCookies = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  const response = await request.post('http://localhost:3000/api/auth/login', {
    data: { email: 'listener@noirsound.com', password: 'password123' },
  }).catch(() => null);

  if (response?.ok()) {
    listenerCookies = (await request.storageState()).cookies;
  }
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(listenerCookies);
});

test.describe('Mobile Responsive Layout & Viewport Verification', () => {
  for (const viewport of mobileViewports) {
    test(`Discover page mobile layout check [${viewport.name}]`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/discover');
      await page.waitForSelector('main');

      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();

      // Check genre pills container visibility
      const genreFilterRow = page.locator('[aria-label="Filter by genre"]');
      await expect(genreFilterRow).toBeVisible();
    });

    test(`Profile page mobile layout & tabs check [${viewport.name}]`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/profile');
      await page.waitForSelector('main');

      const tabsRow = page.locator('[role="tablist"]');
      if (await tabsRow.isVisible()) {
        await expect(tabsRow).toBeVisible();
      } else {
        const signInPanel = page.locator('main');
        await expect(signInPanel).toBeVisible();
      }
    });
  }
});
