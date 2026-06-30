import { test, expect } from '@playwright/test';

// i18n + theme switching persist across reloads without layout breakage.
// Frontend-only: no backend required.
test.describe('public beta · i18n & theme', () => {
  test('language selection persists across reload', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'uk'));
    await page.goto('/');
    // Ukrainian label for nav.home is "Головна".
    await expect(page.getByText('Головна').first()).toBeVisible({ timeout: 8000 });

    await page.reload();
    await expect(page.getByText('Головна').first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('noirsound_language'))).toBe('uk');
  });

  test('theme selection persists across reload', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noirsound.theme', 'midnight-blue'));
    await page.goto('/');
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.dataset.themePreference)
    ).toBe('midnight-blue');

    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.themePreference)).toBe('midnight-blue');
    // A resolved theme is always applied to the root element.
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeTruthy();
  });

  test('English default renders home navigation', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'en'));
    await page.goto('/');
    await expect(page.getByText('Home').first()).toBeVisible({ timeout: 8000 });
  });
});
