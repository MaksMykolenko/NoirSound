import { expect, test } from '@playwright/test';
import { API_BASE, backendUp, loginApi, uploadTrackViaApi } from './_helpers';

test.describe('Music / Beats content separation', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — full-stack Music / Beats test skipped.');
  });

  test('uploads both types and keeps one shared playback, playlist, profile, and moderation surface', async ({ page }) => {
    test.setTimeout(240_000);
    expect(await loginApi(page.request, 'artist@noirsound.com')).toBeTruthy();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const musicTitle = `Music separation ${suffix}`;
    const beatTitle = `Beat separation ${suffix}`;
    const musicUpload = await uploadTrackViaApi(page.request, {
      title: musicTitle,
      contentType: 'MUSIC',
    });
    const beatUpload = await uploadTrackViaApi(page.request, {
      title: beatTitle,
      contentType: 'BEAT',
      beatBpm: 142,
      beatKey: 'F# Minor',
      beatMood: 'Nocturnal',
      beatStyle: 'Trap',
      beatLicenseType: 'Contact for terms',
      beatUsageNotes: 'Non-commercial demos are allowed with credit.',
      beatContactEnabled: true,
    });

    const [musicResponse, beatResponse, beatDetailResponse] = await Promise.all([
      page.request.get(`${API_BASE}/tracks?contentType=MUSIC`),
      page.request.get(`${API_BASE}/tracks?contentType=BEAT`),
      page.request.get(`${API_BASE}/tracks/${beatUpload.trackId}`),
    ]);
    expect(musicResponse.ok()).toBeTruthy();
    expect(beatResponse.ok()).toBeTruthy();
    expect(beatDetailResponse.ok()).toBeTruthy();
    const musicCatalog = (await musicResponse.json()).data;
    const beatCatalog = (await beatResponse.json()).data;
    const beat = (await beatDetailResponse.json()).track;
    expect(musicCatalog.some((track) => track.id === musicUpload.trackId)).toBeTruthy();
    expect(musicCatalog.some((track) => track.id === beatUpload.trackId)).toBeFalsy();
    expect(beatCatalog.some((track) => track.id === beatUpload.trackId)).toBeTruthy();
    expect(beatCatalog.some((track) => track.id === musicUpload.trackId)).toBeFalsy();
    expect(beat).toMatchObject({
      contentType: 'BEAT',
      beatBpm: 142,
      beatKey: 'F# Minor',
      beatMood: 'Nocturnal',
      beatStyle: 'Trap',
      beatContactEnabled: true,
    });

    const playlistName = `Beat checks ${suffix}`;
    const playlistCreate = await page.request.post(`${API_BASE}/playlists`, {
      data: { name: playlistName, description: 'Music / Beats E2E', isPublic: true },
    });
    expect(playlistCreate.status()).toBe(201);
    const playlist = (await playlistCreate.json()).playlist;

    await page.goto('/discover?content=MUSIC');
    await expect(page.getByRole('tab', { name: 'Music' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('searchbox', { name: 'Search releases' }).fill(musicTitle);
    await expect(page.getByText(musicTitle).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(beatTitle)).toHaveCount(0);

    await page.getByRole('tab', { name: 'Beats' }).click();
    await expect(page).toHaveURL(/\/discover\?content=BEAT/);
    await page.getByRole('searchbox', { name: 'Search releases' }).fill(beatTitle);
    await expect(page.getByTestId('beat-discover-filters')).toBeVisible();
    const beatCard = page.getByTestId('all-releases')
      .locator(`[data-track-id="${beatUpload.trackId}"]`);
    await expect(beatCard).toBeVisible({ timeout: 15_000 });
    await expect(beatCard.getByTestId('beat-badge').first()).toBeVisible();
    await expect(beatCard.getByText(/142 BPM/)).toBeVisible();
    await expect(page.getByText(musicTitle)).toHaveCount(0);

    await beatCard.click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Play beat' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Add beat to playlist' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Go to beat' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Go to producer' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Contact producer' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Report' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Add beat to playlist' }).click();

    const addDialog = page.getByRole('dialog', { name: 'Add to playlist' });
    await expect(addDialog).toBeVisible();
    await addDialog.getByRole('button', { name: new RegExp(playlistName) }).click();
    await expect(page.getByText(new RegExp(`Added .*${playlistName}`))).toBeVisible();
    await addDialog.getByRole('button', { name: 'Close' }).click();

    await beatCard.hover();
    await beatCard.getByRole('button', { name: `Play ${beatTitle}` }).click();
    await expect(beatCard.getByRole('button', { name: `Pause ${beatTitle}` })).toBeVisible();

    const playlistResponse = await page.request.get(`${API_BASE}/playlists/${playlist.id}`);
    expect(playlistResponse.ok()).toBeTruthy();
    expect((await playlistResponse.json()).playlist.tracks.some((entry) => (
      (entry.track?.id || entry.id) === beatUpload.trackId
    ))).toBeTruthy();

    await page.goto(`/playlist/${playlist.id}`);
    const playlistRow = page.locator(`table tr[data-track-id="${beatUpload.trackId}"]`);
    await expect(playlistRow).toBeVisible();
    await expect(playlistRow.getByTestId('beat-badge')).toBeVisible();
    await playlistRow.hover();
    await expect(playlistRow.getByRole('button', { name: `Play ${beatTitle} from here` })).toBeVisible();

    await page.goto(`/artist/${beat.artistId}`);
    const beatsSection = page.getByTestId('artist-beats');
    const artistBeatCard = beatsSection.locator(`[data-track-id="${beatUpload.trackId}"]`);
    await expect(artistBeatCard.getByText(beatTitle)).toBeVisible();
    await expect(artistBeatCard.getByTestId('beat-badge')).toBeVisible();

    await page.goto(`/track/${beatUpload.trackId}`);
    const details = page.getByTestId('beat-details');
    await expect(page.getByTestId('beat-badge').first()).toBeVisible();
    await expect(details.getByText('142')).toBeVisible();
    await expect(details.getByText('F# Minor')).toBeVisible();
    await expect(details.getByText('Nocturnal')).toBeVisible();
    await expect(details.getByRole('link', { name: 'Contact producer' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/discover?content=BEAT');
    await expect(page.getByTestId('discover-content-tabs')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Beats' })).toHaveAttribute('aria-selected', 'true');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(392);

    await page.request.delete(`${API_BASE}/playlists/${playlist.id}`);
  });
});
