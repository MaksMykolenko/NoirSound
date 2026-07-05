import { expect, test } from '@playwright/test';
import { API_BASE, backendUp, makeWavBuffer, uploadTrackViaApi } from './_helpers';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

test.describe('Lyrics system', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — full-stack lyrics test skipped.');
  });

  test('uploads, displays, plays, edits, and moderates artist-provided lyrics', async ({ page }) => {
    test.setTimeout(180_000);
    const suffix = Date.now();
    const title = `Lyrics E2E ${suffix}`;
    const originalLyrics = 'Neon rain across the avenue\nOriginal words remain unchanged';
    const revisedLyrics = 'Revised line from the artist\nStill exactly as written';

    const login = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: 'artist@noirsound.com', password: 'password123' },
    });
    expect(login.ok()).toBeTruthy();

    await page.goto('/upload');
    await page.getByLabel('Select track audio file').setInputFiles({
      name: `lyrics-${suffix}.wav`,
      mimeType: 'audio/wav',
      buffer: makeWavBuffer(2),
    });
    await page.getByLabel('Select track artwork').setInputFiles({
      name: `lyrics-${suffix}.png`,
      mimeType: 'image/png',
      buffer: ONE_PIXEL_PNG,
    });
    await page.getByLabel('Track Title').fill(title);
    await page.getByTestId('genre-picker-trigger').click();
    await page.locator('[data-genre-option="electronic"]').click();

    const lyricsSummary = page.locator('summary').filter({ hasText: 'Lyrics (optional)' });
    await expect(lyricsSummary).toHaveCount(1);
    await lyricsSummary.click();
    await page.getByPlaceholder('Enter the lyrics exactly as listeners should read them…')
      .fill(originalLyrics);
    await page.getByLabel('Lyrics language').fill('en');
    await page.getByRole('checkbox', {
      name: 'I confirm that I own these lyrics or have permission to publish them.',
    }).check();
    await page.getByRole('checkbox', {
      name: 'I confirm that I own the rights to this track or have permission to publish it.',
    }).check();
    await page.getByRole('button', { name: 'Submit track to processing' }).click();
    await expect(page.getByRole('heading', { name: 'Ready to Publish' })).toBeVisible({
      timeout: 120_000,
    });

    let uploadedTrack;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const dashboardResponse = await page.request.get(`${API_BASE}/me/artist-dashboard`);
      const dashboard = await dashboardResponse.json();
      uploadedTrack = dashboard.tracks?.find((track) => track.title === title);
      if (uploadedTrack?.status === 'PUBLISHED') break;
      await page.waitForTimeout(500);
    }
    expect(uploadedTrack).toMatchObject({
      title,
      status: 'PUBLISHED',
      hasLyrics: true,
      lyricsType: 'PLAIN',
    });

    await page.goto(`/track/${uploadedTrack.id}`);
    const lyricsCard = page.getByTestId('track-lyrics-card');
    await expect(lyricsCard.getByText(originalLyrics)).toBeVisible();
    await page.getByRole('button', { name: 'Play track' }).click();
    const desktopPlayer = page.getByTestId('desktop-player');
    const playerLyricsButton = desktopPlayer.getByRole('button', { name: 'Lyrics', exact: true });
    await expect(playerLyricsButton).toBeEnabled();
    await playerLyricsButton.click();
    const panel = page.getByRole('dialog', { name: title });
    await expect(panel.getByText(originalLyrics)).toBeVisible();
    await expect(desktopPlayer.getByRole('button', { name: 'Pause' })).toBeVisible();
    await panel.getByRole('button', { name: 'Close lyrics' }).click();
    await expect(panel).toBeHidden();
    await expect(desktopPlayer.getByRole('button', { name: 'Pause' })).toBeVisible();

    const noLyricsTitle = `No Lyrics E2E ${suffix}`;
    const noLyricsTrack = await uploadTrackViaApi(page.request, { title: noLyricsTitle });
    await page.goto(`/track/${noLyricsTrack.trackId}`);
    await expect(page.getByTestId('track-lyrics-card').getByText(
      'Lyrics are not available for this track yet.'
    )).toBeVisible();
    await page.getByRole('button', { name: 'Play track' }).click();
    await expect(page.getByTestId('desktop-player').getByRole('button', {
      name: 'Lyrics unavailable',
      exact: true,
    })).toBeDisabled();

    await page.goto('/dashboard');
    const dashboardEditButtons = page.getByRole('button', { name: `Edit lyrics for ${title}` });
    await expect(dashboardEditButtons).not.toHaveCount(0);
    await dashboardEditButtons.first().click();
    const editor = page.getByRole('dialog', { name: title });
    await editor.getByPlaceholder('Enter the lyrics exactly as listeners should read them…')
      .fill(revisedLyrics);
    await editor.getByRole('button', { name: 'Save lyrics' }).click();
    await expect(editor).toBeHidden();

    await page.goto(`/track/${uploadedTrack.id}`);
    await expect(page.getByTestId('track-lyrics-card').getByText(revisedLyrics)).toBeVisible();

    const adminLogin = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: 'admin@noirsound.com', password: 'password123' },
    });
    expect(adminLogin.ok()).toBeTruthy();
    await page.goto(`/admin/tracks/${uploadedTrack.id}`);
    await expect(page.getByText(revisedLyrics)).toBeVisible();
    await page.getByRole('button', { name: 'Remove lyrics' }).click();
    const confirmation = page.getByRole('dialog', { name: 'Confirm action' });
    await confirmation.getByLabel('Reason').fill('Lyrics E2E moderation removal.');
    await confirmation.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Lyrics are not available for this track yet.')).toBeVisible();

    const publicLyrics = await page.request.get(`${API_BASE}/tracks/${uploadedTrack.id}/lyrics`);
    expect(publicLyrics.ok()).toBeTruthy();
    expect(await publicLyrics.json()).toEqual({
      trackId: uploadedTrack.id,
      hasLyrics: false,
    });
  });
});
