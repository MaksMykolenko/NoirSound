import { describe, expect, it } from 'vitest';
import { mapArtistResponse } from '../artistMapper';
import { mapTrackResponse } from '../trackMapper';

describe('presentation mappers', () => {
  it('uses honest minimal track fallbacks', () => {
    const track = mapTrackResponse({
      id: 'track-1',
      title: '',
      artistId: null,
      artist: null,
      genre: '',
      durationSeconds: 0,
      plays: null,
      likes: null,
      status: 'PUBLISHED',
      processedAudioKey: null,
      tags: [],
    });

    expect(track.title).toBe('Untitled track');
    expect(track.artistName).toBe('Unknown artist');
    expect(track.genre).toBe('No genre');
    expect(track.coverUrl).toBeNull();
    expect(track.duration).toBeNull();
    expect(track.isStreamable).toBe(false);
    expect(track.title).not.toBe('Nightcrawler');
  });

  it('prefers real artist display fields and does not invent an avatar', () => {
    const artist = mapArtistResponse({
      id: 'artist-1',
      user: { displayName: '', username: 'real_creator', avatarUrl: null },
      genres: [],
      monthlyListeners: 0,
    });

    expect(artist.name).toBe('real_creator');
    expect(artist.avatarUrl).toBeNull();
    expect(artist.followers).toBe(0);
  });

  it('uses public availability flags without requiring storage keys', () => {
    const track = mapTrackResponse({
      id: 'track-2',
      title: 'Safe API Shape',
      status: 'PUBLISHED',
      hasCoverImage: true,
      isStreamable: true,
      artist: { user: { displayName: 'Creator' } },
      tags: [],
    });

    expect(track.coverUrl).toContain('/tracks/track-2/cover');
    expect(track.audioUrl).toContain('/tracks/track-2/stream');
    expect(track.isStreamable).toBe(true);
  });
});
