import { test, expect } from '@playwright/test';

test.describe('Design Smoke & Visual Layout Checks', () => {
  test('Home desktop layout verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForSelector('main');

    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
    await expect(page).toHaveTitle(/NoirSound/i);
  });

  test('Track page desktop layout verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/discover');
    await page.waitForSelector('main');
    
    // Click on the first track card or track link to land on a real track page
    const trackCard = page.locator('div.ns-card-interactive, h3, h4').first();
    if (await trackCard.isVisible()) {
      await trackCard.click();
    } else {
      await page.goto('/track/b9fff4e2-14d7-4fe7-bc8c-e6fb19747958');
    }
    await page.waitForTimeout(1000);

    const mainContainer = page.locator('main');
    await expect(mainContainer).toBeVisible();
  });

  test('Upload page desktop layout verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/upload');
    await page.waitForSelector('main');

    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('Mobile home viewport layout verification', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForSelector('header');

    const mobileHeader = page.locator('header').first();
    await expect(mobileHeader).toBeVisible();
  });
});
