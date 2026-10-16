import { test, expect } from '@playwright/test';
import { installFinalDesignFixtures } from './_interactionFixtures';

test.beforeEach(async ({ page }) => { await installFinalDesignFixtures(page); });

test.describe('Home navigation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('primary listening action opens the catalog directly', async ({ page }) => {
    await page.goto('/home');
    await page.getByTestId('home-hero-discover').click();
    await expect(page).toHaveURL(/\/discover/);
    await expect(page.getByTestId('discover-all-content')).toBeVisible();
  });

  test('creator publishing remains reachable from account navigation', async ({ page }) => {
    await page.goto('/home');
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Creator Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Home localization', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders Ukrainian Home copy', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'uk'));
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('home-hero')).toContainText('Головна');
    await expect(page.getByTestId('home-genre-browser')).toHaveCount(0);

  });
});
