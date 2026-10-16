import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../client';
import { getTrackLyrics } from '../real/lyrics';

vi.mock('../client', () => ({ apiFetch: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe('lyrics source routing', () => {
  it('uses the stored playlist position, including zero, for imported Spotify tracks', async () => {
    apiFetch.mockResolvedValue({ hasLyrics: true });
    const result = await getTrackLyrics('source:list:0', { importedPlaylistId: 'private/list', position: 0, title: 'Client title', artistName: 'Client artist' });
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith('/playlist-import/source/private%2Flist/lyrics/0', { suppressErrorToast: true });
    expect(result).toEqual({ hasLyrics: true });
  });

  it('keeps native recordings and external previews on their own endpoints', async () => {
    await getTrackLyrics('native id');
    await getTrackLyrics('preview', { previewExternalId: 'provider/id' });
    await getTrackLyrics('recording', { previewExternalId: 'provider/id', recordingId: 'recording' });
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint)).toEqual([
      '/tracks/native%20id/lyrics', '/external-catalog/preview/provider%2Fid/lyrics', '/tracks/recording/lyrics',
    ]);
  });
});
