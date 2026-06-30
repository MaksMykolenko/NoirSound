import { test, expect } from '@playwright/test';

// Mobile layout integrity at 390x844: no horizontal overflow on core pages.
// Frontend-only: pages render their real empty/error states without a backend.
test.use({ viewport: { width: 390, height: 844 } });

const PAGES = ['/', '/discover', '/upload', '/library', '/profile', '/terms'];

test.describe('public beta · mobile', () => {
  for (const path of PAGES) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(400); // allow lazy route + layout to settle
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      // Allow a 1px rounding tolerance.
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('mobile bottom navigation is visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    // The mobile navbar exposes the primary destinations.
    const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNav.getByText(/Home|Головна/)).toBeVisible({ timeout: 8000 });
  });
});
