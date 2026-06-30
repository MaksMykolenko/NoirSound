import { test, expect } from '@playwright/test';

const SHOTS = 'design-audit-screenshots/home-refresh';

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

test.describe('Home refresh — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('renders the dashboard hierarchy and captures the desktop state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/NoirSound/i);
    await expect(page.getByTestId('home-hero')).toBeVisible();
    await expect(page.getByTestId('home-genre-browser')).toBeVisible();
    await expect(page.getByTestId('home-releases')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/desktop-home-1440x900.png`, fullPage: false });
  });

  test('genre chip pre-fills Discover', async ({ page }) => {
    await page.goto('/');
    const hipHopChip = page.locator('[data-genre-kind="genre"][data-genre-value="hip_hop"]');
    await expect(hipHopChip).toHaveCount(1);
    await hipHopChip.click();
    await expect(page).toHaveURL(/\/discover\?genre=hip_hop$/);
    await expect(
      page.getByTestId('genre-quick-tabs').getByRole('button', { name: 'Hip-Hop', exact: true })
    ).toBeVisible();
  });

  test('Upload CTA reaches the existing auth-guarded upload flow', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-hero-upload').click();
    await expect(page).toHaveURL(/\/upload$/);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Home refresh — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('fits the viewport and leaves content clear of fixed chrome', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('home-hero')).toBeVisible();
    await expect(page.getByTestId('home-releases')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/mobile-home-390x844.png`, fullPage: false });

    const safeArea = page.getByTestId('home-bottom-safe-area');
    await safeArea.scrollIntoViewIfNeeded();
    const clearance = await page.evaluate(() => {
      const sentinel = document.querySelector('[data-testid="home-bottom-safe-area"]');
      const overlays = [...document.querySelectorAll('nav, [class*="fixed"]')]
        .filter((element) => getComputedStyle(element).position === 'fixed')
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.height > 0 && rect.top > window.innerHeight / 2);
      return {
        sentinelBottom: sentinel?.getBoundingClientRect().bottom ?? window.innerHeight,
        overlayTop: overlays.length ? Math.min(...overlays.map((rect) => rect.top)) : window.innerHeight,
      };
    });
    expect(clearance.sentinelBottom).toBeLessThanOrEqual(clearance.overlayTop + 1);
  });

  test('Ukrainian Home copy remains within the mobile viewport', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'uk'));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('home-hero')).toContainText('Знайдіть свій наступний звук');
    await expect(page.getByTestId('home-genre-browser')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/mobile-home-uk-390x844.png`, fullPage: false });
  });
});
