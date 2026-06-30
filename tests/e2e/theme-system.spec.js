import { test, expect } from '@playwright/test';

const SHOTS = 'design-audit-screenshots/themes';
const CONCRETE_THEMES = [
  'noir-pink',
  'midnight-blue',
  'crimson-red',
  'royal-purple',
  'emerald-dark',
  'light-minimal',
  'green-stream',
  'orange-wave',
];
const SURFACE_THEMES = ['noir-pink', 'midnight-blue', 'light-minimal'];
const PLAYER_THEMES = [...SURFACE_THEMES, 'green-stream', 'orange-wave'];
const DISCOVER_THEMES = [...SURFACE_THEMES, 'green-stream'];
const UPLOAD_THEMES = [...SURFACE_THEMES, 'orange-wave'];
let authCookies = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  const response = await request.post('http://localhost:3000/api/auth/login', {
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

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

async function waitForHomeCapture(page) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2000);
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
    await page.goto('/');
    const accountButton = page.locator('header button[aria-haspopup="menu"]');
    await expect(accountButton).toHaveCount(1);
    await accountButton.click();
    await expect(page.getByTestId('compact-theme-selector')).toBeVisible();
  });

  test('new accents propagate to buttons, active navigation, player, and upload surfaces', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openThemeSettings(page);
    await selectTheme(page, 'green-stream');
    await page.goto('/');

    await expect(page.getByTestId('home-hero-discover')).toHaveCSS(
      'background-image',
      /rgb\(30, 215, 96\)/
    );
    await expect(page.getByTestId('player-accent-indicator')).toHaveCSS(
      'color',
      'rgb(30, 215, 96)'
    );
    await expect(page.locator('aside nav a[aria-current="page"]')).toHaveCSS(
      'box-shadow',
      /rgb\(30, 215, 96\)/
    );

    await openThemeSettings(page);
    await selectTheme(page, 'orange-wave');
    await page.goto('/upload');
    const submitButton = page.locator('form button[type="submit"]');
    await expect(submitButton).toHaveCount(1);
    await expect(submitButton).toHaveCSS(
      'background-image',
      /rgb\(255, 106, 0\)/
    );
  });

  test('mobile settings has no horizontal overflow and keeps all theme cards accessible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openThemeSettings(page);
    await expect(page.getByTestId('theme-selector').getByRole('radio')).toHaveCount(9);
    await expectNoHorizontalOverflow(page);
    await page.getByTestId('theme-option-green-stream').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/mobile-theme-selector-390x844.png`, fullPage: false });

    await selectTheme(page, 'green-stream');
    await page.goto('/');
    await waitForHomeCapture(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `${SHOTS}/mobile-green-stream-390x844.png`,
      fullPage: false,
      animations: 'disabled',
    });

    await openThemeSettings(page);
    await selectTheme(page, 'orange-wave');
    await page.goto('/');
    await waitForHomeCapture(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `${SHOTS}/mobile-orange-wave-390x844.png`,
      fullPage: false,
      animations: 'disabled',
    });
  });
});

test.describe('Theme visual captures', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('captures every Home palette and key surfaces for representative themes', async ({ page }) => {
    test.setTimeout(120_000);
    await openThemeSettings(page);

    for (const themeId of CONCRETE_THEMES) {
      await selectTheme(page, themeId);
      await page.goto('/');
      await waitForHomeCapture(page);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SHOTS}/${themeId}-home.png`,
        fullPage: false,
        animations: 'disabled',
      });

      if (PLAYER_THEMES.includes(themeId)) {
        await page.getByTestId('desktop-player').screenshot({
          path: `${SHOTS}/${themeId}-player.png`,
        });
      }

      if (DISCOVER_THEMES.includes(themeId)) {
        await page.goto('/discover');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${SHOTS}/${themeId}-discover.png`, fullPage: false });
      }

      if (UPLOAD_THEMES.includes(themeId)) {
        await page.goto('/upload');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${SHOTS}/${themeId}-upload.png`, fullPage: false });
      }

      if (SURFACE_THEMES.includes(themeId)) {
        await openThemeSettings(page);
        await page.getByTestId('theme-selector').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/${themeId}-profile-settings.png`, fullPage: false });
      }

      if (!SURFACE_THEMES.includes(themeId)) await openThemeSettings(page);
    }
  });
});
