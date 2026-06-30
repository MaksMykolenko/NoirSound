import { test, expect } from '@playwright/test';

// Legal/policy surfaces required for public beta. Frontend-only.
const DOCS = [
  ['/terms', 'Terms of Service'],
  ['/privacy', 'Privacy Policy'],
  ['/guidelines', 'Community Guidelines'],
  ['/copyright', 'Copyright Policy'],
  ['/dmca', 'DMCA / Takedown Policy'],
  ['/abuse', 'Abuse / Report Content'],
  ['/creator-rules', 'Creator Upload Rules'],
];

test.describe('public beta · legal pages', () => {
  for (const [path, heading] of DOCS) {
    test(`renders ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 8000 });
      // The lawyer disclaimer must be present on every policy page.
      await expect(page.getByText(/not legal advice/i)).toBeVisible();
    });
  }

  test('footer exposes legal links from any page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Terms' }).first()).toBeVisible({ timeout: 8000 });
    await page.getByRole('link', { name: 'Privacy' }).first().click();
    await expect(page.getByRole('heading', { name: 'Privacy Policy' }).first()).toBeVisible();
  });
});
