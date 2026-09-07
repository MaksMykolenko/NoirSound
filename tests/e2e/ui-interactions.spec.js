import { expect, test } from '@playwright/test';
import { installFinalDesignFixtures as installFixtures } from './_interactionFixtures';

// These cases use intercepted HTTP responses to exercise component behavior.
// Integration/API suites independently verify authentication and persistence.
test.skip(process.env.VITE_USE_MOCK_API === 'true', 'Requires the real HTTP adapter with isolated fixture responses.');

async function ready(page) {
  await expect(page.locator('main').first()).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading page', exact: true })).toHaveCount(0);
  await page.locator('main').first().getByRole('heading').first().waitFor();
}

function visibleButton(page, name) {
  return page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
}

test('playlist playback and keyboard menus preserve native editable context menus', async ({ page }) => {
  const fixture = await installFixtures(page);
  await page.goto('/playlist/qa-playlist'); await ready(page);
  const row = page.locator('[data-track-id="qa-track-1"]').filter({ visible: true }).first();
  await row.hover(); await row.getByRole('button', { name: /^Play / }).first().click();
  await expect(row).toHaveAttribute('aria-current', 'true');
  await row.locator('a').first().focus(); await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('menu')).toHaveCount(0);

  await page.goto('/upload'); await ready(page);
  for (const selector of ['input[type="text"]', 'textarea']) {
    const input = page.locator('main').first().locator(selector).filter({ visible: true }).first();
    await expect(input).toBeVisible();
    await input.evaluate(node => node.addEventListener('contextmenu', event => {
      setTimeout(() => { node.dataset.contextPrevented = String(event.defaultPrevented); }, 0);
    }, { once: true }));
    await input.dispatchEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
    await expect(input).toHaveAttribute('data-context-prevented', 'false');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await input.focus(); await input.press('Shift+F10');
    await expect(page.getByRole('menu')).toHaveCount(0);
  }
  expect(fixture.unknown).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`nested player menus handle one Escape at a time (${viewport.width < 1024 ? 'mobile' : 'desktop'})`, async ({ page }) => {
    const fixture = await installFixtures(page);
    await page.setViewportSize(viewport); await page.goto('/track/qa-track-1'); await ready(page);
    await page.getByTestId('track-hero').getByRole('button', { name: /^Play/ }).first().click();
    if (viewport.width < 1024) {
      const expand = visibleButton(page, 'Expand player');
      if (await expand.count()) await expand.click();
    }
    await visibleButton(page, 'Open fullscreen lyrics').click();
    const lyrics = page.getByTestId('fullscreen-lyrics-player');
    await expect(lyrics).toBeVisible();
    await expect(lyrics.getByText('The city falls quiet', { exact: false })).toBeVisible();
    for (let tab = 0; tab < 20; tab += 1) {
      await page.keyboard.press('Tab');
      expect(await lyrics.evaluate(node => node.contains(document.activeElement))).toBe(true);
    }
    await visibleButton(page, 'Open play queue').click();
    const queue = page.getByRole('dialog', { name: 'Play Queue', exact: true });
    await expect(queue).toBeVisible();
    await queue.locator('button[aria-haspopup="menu"]').first().click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(queue).toBeVisible(); await expect(lyrics).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(queue).toHaveCount(0); await expect(lyrics).toBeVisible();
    await page.keyboard.press('Escape'); await expect(lyrics).toHaveCount(0);
    await expect(visibleButton(page, 'Open fullscreen lyrics')).toBeFocused();
    expect(fixture.unknown).toEqual([]);
  });
}

test('catalogue errors remain distinct from a successful empty response', async ({ page }) => {
  const fixture = await installFixtures(page);
  const routePattern = /\/api\/discover\/catalog(?:\?|$)/;
  await page.route(routePattern, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, pageInfo: { pageSize: 30, hasNextPage: false, nextCursor: null }, facets: { genres: [], groups: [], styles: [], moods: [], keys: [] }, meta: {} }) }));
  await page.goto('/discover'); await ready(page);
  await expect(page.getByTestId('all-releases').locator('[data-track-id]')).toHaveCount(0);
  await page.unroute(routePattern);
  await page.route(routePattern, route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'SYNTHETIC_API_FAILURE', message: 'Catalogue temporarily unavailable for this isolated test.' }) }));
  await page.reload(); await ready(page);
  await expect(page.getByText('Catalogue temporarily unavailable for this isolated test.').first()).toBeVisible();
  expect(fixture.unknown).toEqual([]);
});

test('Enter on the mobile filter Close button cannot select an option', async ({ page }) => {
  const fixture = await installFixtures(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/discover?content=BEAT'); await ready(page);
  const trigger = page.getByTestId('beat-filter-bpm-trigger'); await trigger.click();
  const panel = page.getByTestId('beat-filter-bpm-trigger-panel'); await expect(panel).toBeVisible();
  const close = panel.getByRole('button', { name: 'Close', exact: true });
  await close.focus(); await close.press('Enter');
  await expect(panel).toHaveCount(0); await expect(page).not.toHaveURL(/bpm=/);
  await expect(trigger).toBeFocused();
  expect(fixture.unknown).toEqual([]);
});

test('batch failure keeps publication disabled and editors support keyboard dismissal', async ({ page }) => {
  const fixture = await installFixtures(page);
  await page.goto('/upload/batch?batch=qa-batch'); await ready(page);
  const list = page.getByTestId('batch-item-list'); await expect(list).toBeVisible();
  await expect(list.getByRole('alert')).toContainText('Synthetic processing failure');
  const steps = page.getByTestId('batch-upload-steps').getByRole('button');
  await steps.nth(3).click(); await expect(page.getByTestId('batch-playlist-editor')).toBeVisible();
  await steps.nth(4).click(); await expect(list).toBeVisible();
  await steps.nth(5).click(); await expect(list).toBeVisible();
  await expect(page.locator('main .ns-button-primary:disabled').first()).toBeDisabled();
  await page.getByTestId('batch-content-type-qa-item-1').click();
  const drawer = page.locator('[role="dialog"][aria-labelledby="batch-track-settings-title"]');
  await expect(drawer).toBeVisible();
  const tabs = drawer.locator('nav').getByRole('button');
  await tabs.nth(2).click(); await expect(drawer.locator('textarea').first()).toBeVisible();
  await tabs.nth(3).click(); await expect(page.getByTestId('batch-rights-tab')).toBeVisible();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    expect(await drawer.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0);
  expect(fixture.unknown).toEqual([]);
});

test('auth switching retains keyboard focus within the dialog and Escape dismisses it', async ({ page }) => {
  const fixture = await installFixtures(page, { guest: true });
  await page.goto('/home'); await ready(page);
  await page.getByRole('button', { name: /^sign in$/i }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^sign up$/i }).click();
  await expect(dialog.getByLabel('Password', { exact: true })).toBeVisible();
  for (let index = 0; index < 16; index += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  expect(fixture.unknown).toEqual([]);
});

test('unsaved profile changes survive switching tabs without sending an update', async ({ page }) => {
  const fixture = await installFixtures(page);
  const updates = [];
  page.on('request', request => {
    if (request.url().includes('/api/auth/me') && ['PATCH', 'PUT'].includes(request.method())) {
      updates.push(request.url());
    }
  });
  await page.goto('/profile?tab=settings'); await ready(page);
  const biography = page.getByLabel('Biography', { exact: true });
  await biography.fill('Unsaved biography kept while switching tabs');
  await page.getByLabel('Choose a profile banner', { exact: true }).setInputFiles('public/images/cover_phonk.png');
  const preview = page.getByAltText('Profile banner preview', { exact: true });
  const previewUrl = await preview.getAttribute('src');
  expect(previewUrl).toMatch(/^blob:/);
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await expect(biography).toHaveValue('Unsaved biography kept while switching tabs');
  await expect(preview).toHaveAttribute('src', previewUrl);
  expect(updates).toEqual([]);
  expect(fixture.unknown).toEqual([]);
});
