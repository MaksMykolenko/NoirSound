import { expect, test } from '@playwright/test';
import { API_BASE, backendUp, makeWavBuffer } from './_helpers';

test.describe('Batch Upload Studio', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — full-stack batch test skipped.');
  });

  test('publishes two singles and an ordered two-track playlist without creating plays', async ({ page }) => {
    test.setTimeout(180_000);
    const login = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: 'artist@noirsound.com', password: 'password123' },
    });
    expect(login.ok()).toBeTruthy();

    await page.goto('/upload/batch');
    await page.getByLabel('Select files').setInputFiles(
      ['one', 'two', 'three', 'four'].map((name) => ({
        name: `batch_${name}.wav`,
        mimeType: 'audio/wav',
        buffer: makeWavBuffer(1),
      }))
    );
    await page.getByRole('button', { name: 'Create batch draft' }).click();
    const firstTrackButton = page.getByRole('button', { name: /^batch one batch_one\.wav/ });
    await expect(firstTrackButton).toBeVisible();

    const names = ['batch one', 'batch two', 'batch three', 'batch four'];
    for (let index = 0; index < names.length; index += 1) {
      await page.getByRole('button', {
        name: new RegExp(`^${names[index]} batch_${['one', 'two', 'three', 'four'][index]}\\.wav`),
      }).click();
      const drawer = page.getByRole('dialog');
      await expect(drawer).toBeVisible();
      await drawer.getByTestId('genre-picker-trigger').click();
      await drawer.locator('[data-genre-option="electronic"]').click();
      if (index >= 2) {
        await drawer.getByRole('combobox', { name: 'Release target', exact: true }).selectOption('PLAYLIST');
      }
      if (index === 0) {
        await drawer.getByRole('button', { name: 'Lyrics' }).click();
        await drawer.getByPlaceholder('Enter the lyrics exactly as listeners should read them…')
          .fill('Batch browser lyric line one\nBatch browser lyric line two');
        await drawer.getByLabel('Lyrics language').fill('en');
        await drawer.getByRole('checkbox', {
          name: 'I confirm that I own these lyrics or have permission to publish them.',
        }).check();
      }
      await drawer.getByRole('button', { name: 'Rights' }).click();
      await drawer.getByRole('checkbox', { name: /own or control the rights/i }).check();
      await drawer.getByRole('button', { name: 'Save draft' }).click();
      await expect(drawer).toBeHidden();
    }

    await page.getByRole('button', { name: 'Configure playlist' }).click();
    const playlistTitle = `Batch E2E ${Date.now()}`;
    await page.getByLabel('Playlist title').fill(playlistTitle);
    await page.getByLabel('Description').fill('Full-stack ordered batch playlist');
    const moveDownButtons = page.getByRole('button', { name: 'Move track down' });
    await expect(moveDownButtons).toHaveCount(2);
    await moveDownButtons.first().click();
    await page.getByRole('button', { name: 'Save playlist' }).click();

    await page.getByRole('button', { name: 'Review' }).click();
    await expect(page.getByText('0', { exact: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Start secure upload' }).click();

    const publish = page.getByRole('button', { name: 'Publish ready tracks' });
    await expect(publish).toBeEnabled({ timeout: 120_000 });
    await publish.click();
    await expect(page.getByText('The batch has been published.')).toBeVisible({ timeout: 20_000 });

    const tracksResponse = await page.request.get(`${API_BASE}/tracks`);
    const tracks = (await tracksResponse.json()).data;
    for (const name of names) {
      expect(tracks.some((track) => track.title === name)).toBeTruthy();
    }
    const lyricsTrack = tracks.find((track) => track.title === names[0]);
    expect(lyricsTrack).toMatchObject({ hasLyrics: true, lyricsType: 'PLAIN' });
    const batchLyrics = await page.request.get(`${API_BASE}/tracks/${lyricsTrack.id}/lyrics`);
    expect((await batchLyrics.json()).lyricsText).toBe(
      'Batch browser lyric line one\nBatch browser lyric line two'
    );

    const playlistLink = page.getByRole('link', { name: 'Open playlist' });
    const href = await playlistLink.getAttribute('href');
    const playlistResponse = await page.request.get(`${API_BASE}${href.replace('/playlist/', '/playlists/')}`);
    const playlist = (await playlistResponse.json()).playlist;
    expect(playlist.tracks.map((entry) => entry.track.title)).toEqual(['batch four', 'batch three']);

    await page.goto(href);
    await expect(page.getByRole('heading', { name: playlistTitle })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open batch four by Velvet Circuit' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open batch three by Velvet Circuit' })).toBeVisible();

    const afterRecent = await page.request.get(`${API_BASE}/me/recently-played`);
    const afterRecentBody = afterRecent.ok() ? await afterRecent.json() : { data: [] };
    const publishedTrackIds = new Set(
      tracks.filter((track) => names.includes(track.title)).map((track) => track.id)
    );
    expect(
      afterRecentBody.data?.some((entry) => publishedTrackIds.has(entry.track?.id)) || false
    ).toBe(false);
  });

  test('isolates a real worker failure, excludes one item, keeps one private, and retries without a duplicate Track', async ({ page, playwright }) => {
    test.setTimeout(120_000);
    const login = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: 'artist@noirsound.com', password: 'password123' },
    });
    expect(login.ok()).toBeTruthy();

    const suffix = Date.now();
    const validAudio = makeWavBuffer(1);
    const invalidAudio = Buffer.from('%PDF-1.7 deliberately invalid batch audio');
    const fileFixtures = [
      { clientId: `good-${suffix}`, fileName: `good-${suffix}.wav`, bytes: validAudio },
      { clientId: `bad-${suffix}`, fileName: `bad-${suffix}.wav`, bytes: invalidAudio },
      { clientId: `private-${suffix}`, fileName: `private-${suffix}.wav`, bytes: validAudio },
      { clientId: `excluded-${suffix}`, fileName: `excluded-${suffix}.wav`, bytes: validAudio },
    ];
    const init = await page.request.post(`${API_BASE}/uploads/batch/init`, {
      data: {
        clientBatchId: `failure-isolation-${suffix}`,
        mode: 'MIXED',
        files: fileFixtures.map((file) => ({
          clientId: file.clientId,
          fileName: file.fileName,
          fileSize: file.bytes.length,
          mimeType: 'audio/wav',
        })),
      },
    });
    expect(init.ok()).toBeTruthy();
    const initialized = await init.json();
    const batchId = initialized.batchId;
    const uploadByClientId = new Map(initialized.uploads.map((upload) => [upload.clientId, upload]));

    for (const file of fileFixtures.filter((fixture) => !fixture.clientId.startsWith('excluded-'))) {
      const put = await page.request.put(uploadByClientId.get(file.clientId).audioUploadUrl, {
        headers: { 'content-type': 'audio/wav' },
        data: file.bytes,
      });
      expect(put.ok()).toBeTruthy();
    }

    const initialState = await page.request.get(`${API_BASE}/uploads/batch/${batchId}`);
    const initialBatch = (await initialState.json()).batch;
    const itemByClientId = new Map(initialBatch.items.map((item) => [item.clientId, item]));
    const patchItem = (clientId, data) => page.request.patch(
      `${API_BASE}/uploads/batch/${batchId}/items/${itemByClientId.get(clientId).id}`,
      { data }
    );
    for (const file of fileFixtures.slice(0, 3)) {
      const response = await patchItem(file.clientId, {
        title: file.clientId,
        primaryArtistName: 'Velvet Circuit',
        genre: 'electronic',
        tags: ['e2e'],
        copyrightConfirmed: true,
        target: 'SINGLE',
        visibility: file.clientId.startsWith('private-') ? 'PRIVATE' : 'PUBLIC',
        ...(file.clientId.startsWith('good-') ? {
          lyricsText: 'Partial batch lyric',
          lyricsType: 'PLAIN',
          lyricsLanguage: 'en',
          lyricsRightsConfirmed: true,
        } : {}),
      });
      expect(response.ok()).toBeTruthy();
    }
    expect((await patchItem(fileFixtures[3].clientId, { target: 'EXCLUDED' })).ok()).toBeTruthy();

    const complete = await page.request.post(`${API_BASE}/uploads/batch/${batchId}/complete`);
    expect(complete.ok()).toBeTruthy();

    let processedBatch;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await page.request.get(`${API_BASE}/uploads/batch/${batchId}`);
      processedBatch = (await state.json()).batch;
      const statuses = new Map(processedBatch.items.map((item) => [item.clientId, item.status]));
      if (
        statuses.get(fileFixtures[0].clientId) === 'READY'
        && statuses.get(fileFixtures[1].clientId) === 'FAILED'
        && statuses.get(fileFixtures[2].clientId) === 'READY'
        && statuses.get(fileFixtures[3].clientId) === 'EXCLUDED'
      ) break;
      await page.waitForTimeout(500);
    }
    const processedByClientId = new Map(processedBatch.items.map((item) => [item.clientId, item]));
    expect(processedByClientId.get(fileFixtures[0].clientId).status).toBe('READY');
    expect(processedByClientId.get(fileFixtures[1].clientId).status).toBe('FAILED');
    expect(processedByClientId.get(fileFixtures[2].clientId).status).toBe('READY');
    expect(processedByClientId.get(fileFixtures[3].clientId).status).toBe('EXCLUDED');

    const strictPublish = await page.request.post(`${API_BASE}/uploads/batch/${batchId}/publish`, {
      data: { allowPartial: false },
    });
    expect(strictPublish.status()).toBe(409);
    const partialPublish = await page.request.post(`${API_BASE}/uploads/batch/${batchId}/publish`, {
      data: { allowPartial: true },
    });
    expect(partialPublish.ok()).toBeTruthy();
    expect((await partialPublish.json()).partial).toBe(true);

    const publishedState = await page.request.get(`${API_BASE}/uploads/batch/${batchId}`);
    const publishedBatch = (await publishedState.json()).batch;
    const publishedByClientId = new Map(publishedBatch.items.map((item) => [item.clientId, item]));
    const publicTrack = publishedByClientId.get(fileFixtures[0].clientId);
    const failedTrack = publishedByClientId.get(fileFixtures[1].clientId);
    const privateTrack = publishedByClientId.get(fileFixtures[2].clientId);
    expect(publicTrack.status).toBe('PUBLISHED');
    expect(failedTrack.status).toBe('FAILED');
    expect(privateTrack.status).toBe('PUBLISHED');

    const catalog = (await (await page.request.get(`${API_BASE}/tracks`)).json()).data;
    expect(catalog.some((track) => track.id === publicTrack.trackId)).toBeTruthy();
    expect(catalog.some((track) => track.id === privateTrack.trackId)).toBeFalsy();
    const publicLyrics = await page.request.get(`${API_BASE}/tracks/${publicTrack.trackId}/lyrics`);
    expect((await publicLyrics.json()).lyricsText).toBe('Partial batch lyric');
    const ownerPrivate = await page.request.get(`${API_BASE}/tracks/${privateTrack.trackId}`);
    expect(ownerPrivate.ok()).toBeTruthy();
    const anonymous = await playwright.request.newContext();
    const anonymousPrivate = await anonymous.get(`${API_BASE}/tracks/${privateTrack.trackId}`);
    expect(anonymousPrivate.status()).toBe(404);
    await anonymous.dispose();

    const failedTrackId = failedTrack.trackId;
    const retry = await page.request.post(
      `${API_BASE}/uploads/batch/${batchId}/items/${failedTrack.id}/retry`
    );
    expect(retry.ok()).toBeTruthy();
    let retriedItem;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await page.request.get(`${API_BASE}/uploads/batch/${batchId}`);
      retriedItem = (await state.json()).batch.items.find((item) => item.id === failedTrack.id);
      if (retriedItem.status === 'FAILED') break;
      await page.waitForTimeout(500);
    }
    expect(retriedItem.status).toBe('FAILED');
    expect(retriedItem.trackId).toBe(failedTrackId);
  });
});
