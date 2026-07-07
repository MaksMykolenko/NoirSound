import { expect, test } from '@playwright/test';
import { API_BASE, backendUp } from './_helpers';

async function loginAsListener(page) {
  const response = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email: 'listener@noirsound.com', password: 'password123' },
  });
  expect(response.ok()).toBeTruthy();
}

async function createFixture(page, { withTrack = false } = {}) {
  const suffix = Date.now();
  const created = await page.request.post(`${API_BASE}/playlists`, {
    data: {
      name: `Playlist E2E ${suffix}`,
      description: 'Playlist context-menu fixture',
      isPublic: true,
    },
  });
  expect(created.status()).toBe(201);
  const playlist = (await created.json()).playlist;

  if (withTrack) {
    const tracksResponse = await page.request.get(`${API_BASE}/tracks`);
    expect(tracksResponse.ok()).toBeTruthy();
    const body = await tracksResponse.json();
    const track = (body.data || body.tracks || body)[0];
    expect(track?.id).toBeTruthy();
    const added = await page.request.post(`${API_BASE}/playlists/${playlist.id}/tracks`, {
      data: { trackId: track.id },
    });
    expect(added.status()).toBe(201);
  }
  return playlist;
}

test.describe('Playlists and custom context menu', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — full-stack playlist test skipped.');
    await loginAsListener(page);
  });

  test('creates, edits, and deletes a playlist through the owner UI', async ({ page }) => {
    const suffix = Date.now();
    const initialName = `UI Playlist ${suffix}`;
    const editedName = `Edited Playlist ${suffix}`;

    await page.goto('/library?tab=playlists');
    await page.getByRole('button', { name: 'New playlist' }).click();
    const createDialog = page.getByRole('dialog', { name: 'New Playlist' });
    await createDialog.getByLabel('Playlist name').fill(initialName);
    await createDialog.getByText('Public playlist').click();
    await createDialog.getByRole('button', { name: 'Create Playlist' }).click();

    await expect(page.getByRole('heading', { level: 1, name: initialName })).toBeVisible();
    await page.getByRole('button', { name: 'Edit playlist' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit playlist' });
    await editDialog.getByLabel('Name').fill(editedName);
    await editDialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: editedName })).toBeVisible();

    await page.getByTestId('playlist-hero').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete playlist' }).click();
    const deleteDialog = page.getByRole('alertdialog');
    await expect(deleteDialog).toContainText(editedName);
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/library\?tab=playlists$/);
  });

  test('supports right click, keyboard invocation, track actions, and editable-field exceptions', async ({ page }) => {
    const playlist = await createFixture(page, { withTrack: true });
    await page.goto(`/playlist/${playlist.id}`);

    const track = page.locator('[data-track-id]').filter({ visible: true });
    await expect(track).toHaveCount(1);
    await track.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Play next' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Add to playlist' })).toBeVisible();
    await page.keyboard.press('Escape');

    const hero = page.getByTestId('playlist-hero');
    await hero.focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menuitem', { name: 'Edit playlist' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(hero).toBeFocused();

    await page.goto('/library?tab=playlists');
    const filter = page.getByPlaceholder('Filter library');
    await filter.click({ button: 'right' });
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.request.delete(`${API_BASE}/playlists/${playlist.id}`);
  });

  test('renders a collision-safe mobile action sheet', async ({ page }) => {
    const playlist = await createFixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/playlist/${playlist.id}`);
    await page.getByTestId('playlist-hero').click({ button: 'right' });

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);

    await page.keyboard.press('Escape');
    await page.request.delete(`${API_BASE}/playlists/${playlist.id}`);
  });
});
