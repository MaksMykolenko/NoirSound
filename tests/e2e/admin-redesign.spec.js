import { expect, test } from '@playwright/test';
import { makeWavBuffer } from './_helpers.js';

const ADMIN_ROUTES = [
  '/admin/overview',
  '/admin/reports',
  '/admin/users',
  '/admin/tracks',
  '/admin/artists',
  '/admin/comments',
  '/admin/uploads',
  '/admin/audit-logs',
  '/admin/system',
  '/admin/system/stats',
  '/admin/settings',
];

async function expectIsolatedAdminShell(page) {
  await expect(page.getByTestId('admin-shell')).toHaveCount(1);
  await expect(page.getByTestId('admin-sidebar')).toHaveCount(1);
  await expect(page.getByTestId('admin-topbar')).toHaveCount(1);
  await expect(page.getByTestId('desktop-player')).toHaveCount(0);
  await expect(page.getByTestId('mobile-collapsed-player')).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Discover', exact: true })).toHaveCount(0);
  await expect(page.getByText('Your Library', { exact: true })).toHaveCount(0);
}

test('all admin routes stay in one isolated shell without listener modules', { tag: '@demo' }, async ({ page }) => {
  const requestedModules = [];
  page.on('request', (request) => requestedModules.push(request.url()));

  await page.goto('/admin/overview');
  await expect(page.locator('h1')).toHaveText('Overview');
  await expectIsolatedAdminShell(page);

  for (const route of ADMIN_ROUTES.slice(1)) {
    await page.goto(route);
    await expect(page.getByTestId('admin-shell')).toBeVisible();
    await expectIsolatedAdminShell(page);
  }

  const listenerModules = requestedModules.filter((url) => (
    url.includes('/src/components/layout/PublicAppShell.jsx')
    || url.includes('/src/components/layout/AppLayout.jsx')
    || url.includes('/src/components/player/')
    || url.includes('/src/store/playerStore.js')
  ));
  expect(listenerModules).toEqual([]);
});

test('audit URL filters survive refresh and history while the drawer supports keyboard and safe copy', { tag: '@demo' }, async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const previewAudio = makeWavBuffer();
  await page.route('https://www.soundhelix.com/**', (route) => route.fulfill({
    status: 206,
    contentType: 'audio/wav',
    headers: {
      'accept-ranges': 'bytes',
      'content-range': `bytes 0-${previewAudio.length - 1}/${previewAudio.length}`,
    },
    body: previewAudio,
  }));
  await page.goto('/admin/audit-logs?q=demo_moderator&action=TRACK_HIDE&resource=TRACK&limit=25');

  const search = page.getByLabel('Full-text search');
  await expect(search).toHaveValue('demo_moderator');
  await expect(page.getByLabel('Action')).toHaveValue('TRACK_HIDE');
  await expect(page.getByLabel('Resource')).toHaveValue('TRACK');
  await expect(page.getByLabel('Rows per page')).toHaveValue('25');
  await expect(page.getByRole('columnheader', { name: 'Reason' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Request ID' })).toBeVisible();

  await page.getByLabel('Resource').selectOption('USER');
  await expect(page).toHaveURL(/resource=USER/);
  await page.goBack();
  await expect(page.getByLabel('Resource')).toHaveValue('TRACK');
  await page.goForward();
  await expect(page.getByLabel('Resource')).toHaveValue('USER');
  await page.goBack();
  await page.reload();
  await expect(search).toHaveValue('demo_moderator');
  await expect(page.getByLabel('Action')).toHaveValue('TRACK_HIDE');
  await expect(page.getByLabel('Resource')).toHaveValue('TRACK');

  const row = page.locator('[data-testid^="audit-row-"]').first();
  await expect(row).toBeVisible();
  await row.focus();
  await row.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/event=demo-audit-/);
  await expect(dialog.getByText('TRACK_HIDE', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Copy sanitized event JSON' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('"action": "TRACK_HIDE"');
  expect(copied).not.toContain('@example.invalid');

  await dialog.getByRole('slider', { name: 'Preview volume' }).focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/event=/);
  await expect(row).toBeFocused();
});

test('a reasoned demo moderation mutation creates a visible audit event', { tag: '@demo' }, async ({ page }) => {
  const reason = `E2E moderation reason ${Date.now()}`;
  const previewAudio = makeWavBuffer();
  await page.route('https://www.soundhelix.com/**', (route) => route.fulfill({
    status: 206,
    contentType: 'audio/wav',
    headers: {
      'accept-ranges': 'bytes',
      'content-range': `bytes 0-${previewAudio.length - 1}/${previewAudio.length}`,
    },
    body: previewAudio,
  }));
  await page.goto('/admin/tracks?track=1');

  const drawer = page.getByTestId('admin-track-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel('Preview Nightcrawler')).toHaveAttribute('src', /SoundHelix-Song-1\.mp3/);
  await drawer.getByRole('button', { name: 'Hide', exact: true }).click();
  const confirmDialog = page.locator('[role="dialog"]').filter({
    has: page.getByRole('textbox', { name: 'Reason' }),
  });
  await confirmDialog.getByRole('textbox', { name: 'Reason' }).fill(reason);
  await confirmDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(confirmDialog).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: 'Unhide', exact: true })).toBeVisible();

  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await page.getByRole('link', { name: 'Audit Logs', exact: true }).click();
  await page.getByLabel('Full-text search').fill(reason);
  const auditRow = page.locator('[data-testid^="audit-row-"]').first();
  await expect(auditRow).toContainText(reason);
  await expect(auditRow).toContainText('Track hidden');
});

test('returning from admin opens landing and retains the application player shell', { tag: '@demo' }, async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/admin/overview');
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await expectIsolatedAdminShell(page);

  await page.getByRole('link', { name: 'Back to NoirSound' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yoursound.');
  // A direct admin visit has no selected track. The public landing intentionally
  // hides the empty player; entering the application must still restore it.
  await expect(page.getByTestId('desktop-player')).toHaveCount(0);
  await page.getByRole('link', { name: 'Open NoirSound', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.getByTestId('desktop-player')).toBeVisible();
});
