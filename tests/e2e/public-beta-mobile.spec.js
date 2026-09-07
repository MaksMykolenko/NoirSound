import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('public beta · mobile', () => {
  test('mobile navigation opens Discover', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/home');
    // The mobile navbar exposes the primary destinations.
    const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNav.getByText(/Home|Головна/)).toBeVisible({ timeout: 8000 });
    await mobileNav.getByRole('link', { name: /Discover|Пошук|Відкрийте/ }).click();
    await expect(page).toHaveURL(/\/discover$/);
  });
});
