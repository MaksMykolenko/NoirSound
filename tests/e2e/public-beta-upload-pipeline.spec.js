import { test, expect } from '@playwright/test';
import { API_BASE, backendUp, loginApi, uploadTrackViaApi } from './_helpers';

// End-to-end: upload -> worker -> PUBLISHED -> stream -> play event -> catalog.
test.describe('public beta · upload pipeline', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — full-stack test skipped.');
  });

  test('uploads, processes, streams, and records a play', async ({ playwright, page }) => {
    test.setTimeout(120_000);
    const artist = await playwright.request.newContext();
    expect(await loginApi(artist, 'artist@noirsound.com')).toBeTruthy();

    const { trackId } = await uploadTrackViaApi(artist, { title: `E2E ${Date.now()}` });
    expect(trackId).toBeTruthy();

    // Track is in the public catalog.
    const list = await artist.get(`${API_BASE}/tracks`);
    const catalog = (await list.json()).data;
    expect(catalog.some((t) => t.id === trackId)).toBeTruthy();
    const publicTrack = catalog.find((t) => t.id === trackId);
    expect(publicTrack).not.toHaveProperty('originalAudioKey');
    expect(publicTrack).not.toHaveProperty('processedAudioKey');
    expect(publicTrack).not.toHaveProperty('coverImageKey');
    expect(publicTrack.isStreamable).toBe(true);

    // Stream endpoint redirects to a signed URL; following it returns audio.
    const stream = await artist.get(`${API_BASE}/tracks/${trackId}/stream`, {
      headers: { Range: 'bytes=0-1024' },
      maxRedirects: 5,
    });
    expect([200, 206]).toContain(stream.status());
    expect((stream.headers()['content-type'] || '')).toContain('audio');

    // Record a play event and confirm acceptance.
    const play = await artist.post(`${API_BASE}/tracks/${trackId}/play-event`, {
      data: { durationListenedSeconds: 35, completed: true, source: 'e2e' },
    });
    expect(play.ok()).toBeTruthy();

    // The track page renders the real track.
    await page.goto(`/track/${trackId}`);
    await expect(page.getByText(/E2E/).first()).toBeVisible({ timeout: 10_000 });

    await artist.dispose();
  });

  test('rejects a non-audio file at the worker (magic-byte check)', async ({ playwright }) => {
    const artist = await playwright.request.newContext();
    await loginApi(artist, 'artist@noirsound.com');
    const fakeBytes = Buffer.from('%PDF-1.7 not audio at all');
    const init = await artist.post(`${API_BASE}/uploads/track/init`, {
      data: {
        title: `Bad ${Date.now()}`, genre: 'electronic', tags: ['e2e'], copyrightConfirmed: true,
        audio: { filename: 'fake.wav', mimeType: 'audio/wav', sizeBytes: fakeBytes.length },
      },
    });
    expect(init.ok()).toBeTruthy();
    const { uploadId, audioUploadUrl } = await init.json();
    await artist.put(audioUploadUrl, { headers: { 'content-type': 'audio/wav' }, data: fakeBytes });
    await artist.post(`${API_BASE}/uploads/track/${uploadId}/complete`);

    let finalStatus = '';
    for (let i = 0; i < 20; i += 1) {
      const s = await artist.get(`${API_BASE}/uploads/track/${uploadId}/status`);
      finalStatus = (await s.json()).status;
      if (finalStatus === 'FAILED' || finalStatus === 'READY') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(finalStatus).toBe('FAILED');
    await artist.dispose();
  });
});
