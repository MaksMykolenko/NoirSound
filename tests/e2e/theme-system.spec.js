import { test, expect } from '@playwright/test';
import { API_BASE } from './_helpers.js';

let authCookies = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  if (process.env.VITE_USE_MOCK_API === 'true') return; // Demo mode already provides its local artist session.
  const response = await request.post(`${API_BASE}/auth/login`, {
    data: { email: 'artist@noirsound.com', password: 'password123' },
  });
  expect(response.ok()).toBeTruthy();
  authCookies = (await request.storageState()).cookies;
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(authCookies);
});

async function openThemeSettings(page) {
  await page.goto('/profile?tab=settings');
  await expect(page.getByTestId('theme-selector')).toBeVisible();
}

async function selectTheme(page, themeId) {
  const option = page.getByTestId(`theme-option-${themeId}`);
  await expect(option).toHaveCount(1);
  await option.click();
  const resolvedTheme = themeId === 'system' ? /noir-pink|light-minimal/ : themeId;
  await expect(page.locator('html')).toHaveAttribute('data-theme', resolvedTheme);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', themeId);
}

test.describe('Theme system behavior', () => {
  test('selection applies instantly, persists after reload, and System follows OS preference', async ({ page }) => {
    await openThemeSettings(page);

    await selectTheme(page, 'midnight-blue');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight-blue');
    await expect(page.getByTestId('theme-option-midnight-blue')).toHaveAttribute('aria-checked', 'true');

    await selectTheme(page, 'green-stream');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'green-stream');
    await expect(page.getByTestId('theme-option-green-stream')).toHaveAttribute('aria-checked', 'true');

    await selectTheme(page, 'orange-wave');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'orange-wave');

    await selectTheme(page, 'light-minimal');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light-minimal');

    await page.emulateMedia({ colorScheme: 'light' });
    await selectTheme(page, 'system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light-minimal');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'noir-pink');
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  });

  test('account dropdown exposes the compact theme selector', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/home');
    const accountButton = page.locator('header button[aria-haspopup="menu"]');
    await expect(accountButton).toHaveCount(1);
    await accountButton.click();
    await expect(page.getByTestId('compact-theme-selector')).toBeVisible();
  });

});
