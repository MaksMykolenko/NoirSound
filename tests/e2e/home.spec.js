import { test, expect } from '@playwright/test';

test.describe('Home navigation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('genre chip pre-fills Discover', async ({ page }) => {
    await page.goto('/home');
    const hipHopChip = page.locator('[data-genre-kind="genre"][data-genre-value="hip_hop"]');
    await expect(hipHopChip).toHaveCount(1);
    await hipHopChip.click();
    await expect(page).toHaveURL(/\/discover\?genre=hip_hop$/);
    await expect(
      page.getByTestId('genre-quick-tabs').getByRole('button', { name: 'Hip-Hop', exact: true })
    ).toBeVisible();
  });

  test('Upload CTA reaches the existing auth-guarded upload flow', async ({ page }) => {
    await page.goto('/home');
    await page.getByTestId('home-hero-upload').click();
    await expect(page).toHaveURL(/\/upload$/);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Home localization', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders Ukrainian Home copy', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'uk'));
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('home-hero')).toContainText('Знайдіть свій наступний звук');
    await expect(page.getByTestId('home-genre-browser')).toBeVisible();

  });
});
