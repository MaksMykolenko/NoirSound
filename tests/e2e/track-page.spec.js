import { test, expect } from '@playwright/test';

// Track Page design QA. Backend-tolerant: the reliable assertions exercise the
// page's routing + localized error states (no track data needed); the richer
// hero/waveform/comments checks run when a real published track is reachable.

const SHOTS = 'design-audit-screenshots/track-page-refresh';

async function horizontalOverflow(page) {
  return page.evaluate(() => document.body.scrollWidth - window.innerWidth);
}

// Navigate to a real track via Discover if the backend is serving data.
async function openFirstTrack(page) {
  await page.goto('/discover');
  await page.waitForSelector('main');
  const card = page.locator('[data-track-id]').first();
  if (!(await card.count())) return false;
  await card.click();
  await page.waitForURL(/\/track\//);
  await page.waitForSelector('h1');
  return true;
}

test.describe('Track Page — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('error states render localized, no horizontal overflow', async ({ page }) => {
    await page.goto('/track/__nonexistent__');
    await page.waitForSelector('main');
    await expect(page.getByRole('heading', { name: /Track not found|Track unavailable/ })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('real track hero, waveform and discussion (if backend available)', async ({ page }) => {
    const reached = await openFirstTrack(page);
    test.skip(!reached, 'No published tracks available (backend not seeded)');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Play track|Pause track|Audio unavailable/ })).toBeVisible();
    await expect(page.getByText('Waveform')).toBeVisible();
    await expect(page.getByText('Join the discussion')).toBeVisible();
    // The old dashboard stat grid must be gone.
    await expect(page.getByLabel('Track details')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SHOTS}/desktop-track-1440x900.png`, fullPage: true });
  });
});

test.describe('Track Page — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile error state + no horizontal overflow', async ({ page }) => {
    await page.goto('/track/__nonexistent__');
    await page.waitForSelector('main');
    await expect(page.getByRole('heading', { name: /Track not found|Track unavailable/ })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('real track mobile smoke (if backend available)', async ({ page }) => {
    const reached = await openFirstTrack(page);
    test.skip(!reached, 'No published tracks available (backend not seeded)');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Play track|Pause track|Audio unavailable/ })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    // Content is not hidden behind the bottom nav/player: the discussion heading
    // can be scrolled into view and becomes visible.
    const discussion = page.getByText('Join the discussion');
    await discussion.scrollIntoViewIfNeeded();
    await expect(discussion).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/mobile-track-390x844.png`, fullPage: true });
  });
});

test.describe('Track Page — i18n + themes', () => {
  test('localized error state in Ukrainian', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noirsound_language', 'uk'));
    await page.goto('/track/__nonexistent__');
    await expect(page.getByText(/Трек не знайдено|Трек недоступний/)).toBeVisible();
  });

  for (const theme of ['light-minimal', 'green-stream', 'orange-wave']) {
    test(`renders under ${theme} (screenshot if track available)`, async ({ page }) => {
      await page.addInitScript((th) => localStorage.setItem('noirsound.theme', th), theme);
      await page.setViewportSize({ width: 1440, height: 900 });
      const reached = await openFirstTrack(page);
      test.skip(!reached, 'No published tracks available (backend not seeded)');
      const name = theme === 'light-minimal' ? 'light-theme-track'
        : theme === 'green-stream' ? 'green-stream-track' : 'orange-wave-track';
      await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
    });
  }
});
