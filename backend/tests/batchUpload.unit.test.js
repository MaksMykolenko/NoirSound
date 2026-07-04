import { describe, expect, it } from 'vitest';
import { MAX_BATCH_BYTES, MAX_BATCH_FILES, validateBatchFiles } from '../src/routes/uploadBatches';
import {
  buildBatchValidation,
  cleanStringList,
  inferTrackTitle,
  itemMissingFields,
  serializeBatch,
} from '../src/lib/batchUpload';
import { isFinalJobAttempt } from '../src/workers/audioProcessor';

function file(overrides = {}) {
  return {
    clientId: 'local-1',
    fileName: 'track.wav',
    fileSize: 2048,
    mimeType: 'audio/wav',
    ...overrides,
  };
}

function item(overrides = {}) {
  return {
    id: 'item-1',
    target: 'SINGLE',
    status: 'DRAFT',
    title: 'Track',
    primaryArtistName: 'Artist',
    genre: 'electronic',
    copyrightConfirmed: true,
    ...overrides,
  };
}

describe('batch upload validation', () => {
  it('persists worker failure only on the final configured queue attempt', () => {
    expect(isFinalJobAttempt({ attemptsMade: 0, opts: { attempts: 3 } })).toBe(false);
    expect(isFinalJobAttempt({ attemptsMade: 1, opts: { attempts: 3 } })).toBe(false);
    expect(isFinalJobAttempt({ attemptsMade: 2, opts: { attempts: 3 } })).toBe(true);
    expect(isFinalJobAttempt({ attemptsMade: 0, opts: {} })).toBe(true);
  });

  it('validates file count, aggregate size, MIME/extension, and client id uniqueness', () => {
    expect(validateBatchFiles([])).toMatch(/at least one/i);
    expect(validateBatchFiles(Array.from({ length: MAX_BATCH_FILES + 1 }, (_, index) =>
      file({ clientId: `c-${index}` })))).toMatch(/at most/i);
    expect(validateBatchFiles([
      file({ clientId: 'same' }),
      file({ clientId: 'same', fileName: 'other.wav' }),
    ])).toMatch(/duplicate clientId/i);
    expect(validateBatchFiles([file({ fileName: 'track.exe' })])).toMatch(/extension/i);
    expect(validateBatchFiles([file({ mimeType: 'application/pdf' })])).toMatch(/MIME/i);
    expect(validateBatchFiles(Array.from({ length: 11 }, (_, index) =>
      file({
        clientId: `large-${index}`,
        fileName: `large-${index}.wav`,
        fileSize: Math.floor(MAX_BATCH_BYTES / 10),
      })))).toMatch(/total limit/i);
  });

  it('infers readable titles and sanitizes duplicate tags', () => {
    expect(inferTrackTitle('01_midnight-signal.wav')).toBe('01 midnight signal');
    expect(cleanStringList([' dark ', 'dark', '<live>'], { maxItems: 20, maxLength: 30 }))
      .toEqual(['dark', 'live']);
  });

  it('requires title, primary artist, canonical genre, and rights confirmation', () => {
    expect(itemMissingFields(item({
      title: '',
      primaryArtistName: '',
      genre: 'not-a-real-genre',
      copyrightConfirmed: false,
    }))).toEqual(['title', 'primaryArtistName', 'genre', 'copyrightConfirmed']);
    expect(itemMissingFields(item({ target: 'EXCLUDED' }))).toEqual([]);
  });

  it('enables strict and partial publish only for safe processed items', () => {
    const ready = item({ status: 'READY' });
    const failed = item({ id: 'item-2', status: 'FAILED' });
    expect(buildBatchValidation({ items: [ready], playlistTitle: null })).toMatchObject({
      canPublish: true,
      canPublishPartial: true,
      missingFields: [],
    });
    expect(buildBatchValidation({ items: [ready, failed], playlistTitle: null })).toMatchObject({
      canPublish: false,
      canPublishPartial: true,
    });
    expect(buildBatchValidation({
      items: [item({ status: 'READY', target: 'PLAYLIST' })],
      playlistTitle: '',
    }).missingFields).toContainEqual({ scope: 'playlist', field: 'title' });
  });

  it('never serializes private storage keys or presigned URLs', () => {
    const payload = serializeBatch({
      id: 'batch-1',
      mode: 'MIXED',
      status: 'DRAFT',
      artistProfileId: 'artist-1',
      userId: 'user-1',
      playlistTitle: '',
      playlistDescription: '',
      playlistIsPublic: true,
      playlistTags: [],
      playlistCoverStorageKey: 'uploads/private/playlist.png',
      items: [{
        ...item(),
        clientId: 'local-1',
        fileName: 'track.wav',
        fileSize: 2048,
        mimeType: 'audio/wav',
        featuredArtists: [],
        tags: [],
        explicit: false,
        isPublic: true,
        upload: {
          id: 'upload-1',
          status: 'UPLOADING',
          storageKey: 'uploads/private/audio.wav',
          uploadUrl: 'https://storage/private',
          coverStorageKey: 'uploads/private/cover.png',
        },
        track: null,
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(JSON.stringify(payload)).not.toContain('uploads/private');
    expect(JSON.stringify(payload)).not.toContain('https://storage');
    expect(payload.playlist.hasCover).toBe(true);
    expect(payload.items[0].hasCover).toBe(true);
  });
});
