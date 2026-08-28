import { describe, expect, it } from 'vitest';
import {
  cancelBatchUpload,
  completeBatchUpload,
  createBatchUpload,
  getBatchUpload,
  publishBatchUpload,
  updateBatchItem,
} from '../batchUploads';

describe('mock batch upload Music / Beat contract', () => {
  it('keeps lyrics rights blocking and publishes the saved Beat metadata', async () => {
    const file = new File(['audio'], 'night_beat.wav', { type: 'audio/wav' });
    const initialized = await createBatchUpload([{ clientId: 'client-1', file }]);
    const initial = await getBatchUpload(initialized.batchId);
    const itemId = initial.batch.items[0].id;

    const invalidUpdate = {
      genre: 'hip_hop',
      copyrightConfirmed: true,
      lyricsText: 'Original line',
      lyricsType: 'PLAIN',
      lyricsLanguage: 'en',
      lyricsRightsConfirmed: false,
      contentType: 'BEAT',
      beatBpm: 136,
      beatKey: 'D Minor',
      beatMood: 'Focused',
      beatStyle: 'Trap',
      beatLicenseType: 'Contact',
      beatUsageNotes: 'Demo use',
      beatContactEnabled: true,
    };

    await expect(updateBatchItem(initialized.batchId, itemId, invalidUpdate)).rejects.toMatchObject({
      status: 400,
      code: 'LYRICS_RIGHTS_REQUIRED',
    });
    const unchanged = await getBatchUpload(initialized.batchId);
    expect(unchanged.batch.items[0]).toMatchObject({
      genre: null,
      copyrightConfirmed: false,
      hasLyrics: false,
    });

    const readyMetadata = await updateBatchItem(initialized.batchId, itemId, {
      ...invalidUpdate,
      lyricsRightsConfirmed: true,
    });
    expect(readyMetadata.batch.items[0].missingFields).toEqual([]);

    await completeBatchUpload(initialized.batchId);
    const published = await publishBatchUpload(initialized.batchId);
    expect(published.tracks).toEqual([
      expect.objectContaining({
        contentType: 'BEAT',
        beatBpm: 136,
        beatKey: 'D Minor',
        beatMood: 'Focused',
        beatStyle: 'Trap',
        beatLicenseType: 'Contact',
        beatUsageNotes: 'Demo use',
        beatContactEnabled: true,
      }),
    ]);

    await cancelBatchUpload(initialized.batchId);
  });
});
