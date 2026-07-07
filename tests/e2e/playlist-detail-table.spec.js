import { expect, test } from '@playwright/test';
import { API_BASE, backendUp } from './_helpers';

async function loginAsListener(page) {
  const response = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email: 'listener@noirsound.com', password: 'password123' },
  });
  expect(response.ok()).toBeTruthy();
}

async function fetchRealTracks(page, count) {
  const response = await page.request.get(`${API_BASE}/tracks`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const list = body.data || body.tracks || body;
  expect(list.length).toBeGreaterThanOrEqual(count);
  return list.slice(0, count);
}

async function createPlaylistWithTracks(page, { trackCount = 1, isPublic = true } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const created = await page.request.post(`${API_BASE}/playlists`, {
    data: { name: `Table E2E ${suffix}`, description: 'Playlist detail table fixture', isPublic },
  });
  expect(created.status()).toBe(201);
  const playlist = (await created.json()).playlist;

  const tracks = await fetchRealTracks(page, trackCount);
  for (const track of tracks) {
    // eslint-disable-next-line no-await-in-loop
    const added = await page.request.post(`${API_BASE}/playlists/${playlist.id}/tracks`, {
      data: { trackId: track.id },
    });
    expect(added.status()).toBe(201);
  }
  return { playlist, tracks };
}

test.describe('Playlist detail table', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — full-stack playlist table test skipped.');
    await loginAsListener(page);
  });

  test('renders the spec desktop columns and the honest Single fallback for a real track', async ({ page }) => {
    const { playlist, tracks } = await createPlaylistWithTracks(page, { trackCount: 1 });
    await page.goto(`/playlist/${playlist.id}`);

    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Album' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date added' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration' })).toBeVisible();

    const row = page.locator(`table tr[data-track-id="${tracks[0].id}"]`);
    await expect(row).toBeVisible();
    // Ordinary uploaded tracks have no Album row and no batch-release
    // playlist behind them, so the honest fallback is "Single" -- never a
    // fabricated album name.
    await expect(row.getByText('Single')).toBeVisible();

    await page.request.delete(`${API_BASE}/playlists/${playlist.id}`);
  });

  test('plays a track from its row and highlights it as the current track', async ({ page }) => {
    const { playlist, tracks } = await createPlaylistWithTracks(page, { trackCount: 1 });
    await page.goto(`/playlist/${playlist.id}`);

    const row = page.locator(`table tr[data-track-id="${tracks[0].id}"]`);
    await row.hover();
    await row.getByRole('button', { name: `Play ${tracks[0].title} from here` }).click();

    // currentTrack is set synchronously before any network/audio work, so
    // this is reliable even if the real audio stream can't play in CI.
    await expect(row).toHaveAttribute('aria-current', 'true');

    await page.request.delete(`${API_BASE}/playlists/${playlist.id}`);
  });

  test('shows real header track-count stats', async ({ page }) => {
    const { playlist } = await createPlaylistWithTracks(page, { trackCount: 2 });
    await page.goto(`/playlist/${playlist.id}`);

    await expect(page.getByText('2 tracks')).toBeVisible();

    await page.request.delete(`${API_BASE}/playlists/${playlist.id}`);
  });

  test('lets the owner reorder with row controls and remove a track with confirmation', async ({ page }) => {
    const { playlist, tracks } = await createPlaylistWithTracks(page, { trackCount: 2 });
    const [first, second] = tracks;
    await page.goto(`/playlist/${playlist.id}`);

    const rows = page.locator('table tr[data-track-id]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-track-id', first.id);

    await page.getByRole('button', { name: `Move ${second.title} up` }).click();
    await expect(rows.nth(0)).toHaveAttribute('data-track-id', second.id);

    await page.getByRole('button', { name: `More actions for ${second.title}` }).click();
    await page.getByRole('menuitem', { name: 'Remove from this playlist' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(second.title);
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click();

    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-track-id', first.id);

    await page.request.delete(`${API_BASE}/playlists/${playlist.id}`);
  });

  test('renders the mobile row list without horizontal overflow at a phone viewport', async ({ page }) => {
    const { playlist, tracks } = await createPlaylistWithTracks(page, { trackCount: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/playlist/${playlist.id}`);

    // At this width the desktop table is `hidden` (excluded from the a11y
    // tree entirely) and only the mobile row list is rendered/visible.
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.locator(`div[data-track-id="${tracks[0].id}"]`)).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(392); // small tolerance over the 390px viewport

    await page.request.delete(`${API_BASE}/playlists/${playlist.id}`);
  });

  test('blocks a private playlist for a logged-out visitor without leaking its tracks', async ({ page, browser }) => {
    const { playlist, tracks } = await createPlaylistWithTracks(page, { trackCount: 1, isPublic: true });
    const madePrivate = await page.request.patch(`${API_BASE}/playlists/${playlist.id}`, {
      data: { isPublic: false },
    });
    expect(madePrivate.ok()).toBeTruthy();

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/playlist/${playlist.id}`);

    await expect(anonPage.getByText('Private playlist')).toBeVisible();
    await expect(anonPage.getByText('Only the owner can open this playlist.')).toBeVisible();
    // The empty-state page must never leak the hidden playlist's contents.
    await expect(anonPage.getByText(tracks[0].title)).toHaveCount(0);
    await expect(anonPage.getByRole('table')).toHaveCount(0);

    await anonContext.close();
    await page.request.delete(`${API_BASE}/playlists/${playlist.id}`);
  });
});
