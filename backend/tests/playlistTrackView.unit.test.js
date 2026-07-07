import { describe, expect, it } from 'vitest';
import {
  buildPlaylistTrackEntry,
  isTrackAvailable,
  resolveAlbumRelease,
  sanitizeTrackForSerialization,
} from '../src/lib/playlistTrackView';

function baseTrack(overrides = {}) {
  return {
    id: 'track-1',
    title: 'Midnight Drive',
    slug: 'midnight-drive',
    artistId: 'artist-1',
    genre: 'Phonk',
    tags: [],
    durationSeconds: 187,
    duration: 187,
    status: 'PUBLISHED',
    isPublic: true,
    processedAudioKey: 'processed/track-1.mp3',
    explicit: false,
    albumId: null,
    album: null,
    batchItem: null,
    artist: {
      id: 'artist-1',
      isHidden: false,
      user: {
        displayName: 'HyperDrive',
        username: 'hyperdrive',
        avatarUrl: null,
        status: 'ACTIVE',
      },
    },
    ...overrides,
  };
}

const ownerViewer = { id: 'owner-1', role: 'LISTENER' };
const adminViewer = { id: 'admin-1', role: 'ADMIN' };
const strangerViewer = { id: 'stranger-1', role: 'LISTENER' };
const playlist = { id: 'playlist-1', creatorId: 'owner-1', creator: { id: 'owner-1', username: 'owner', displayName: 'Owner' } };

describe('isTrackAvailable', () => {
  it('is available when published, public, processed, and the artist is active', () => {
    expect(isTrackAvailable(baseTrack())).toBe(true);
  });

  it('is unavailable when not published', () => {
    expect(isTrackAvailable(baseTrack({ status: 'HIDDEN' }))).toBe(false);
  });

  it('is unavailable when made private', () => {
    expect(isTrackAvailable(baseTrack({ isPublic: false }))).toBe(false);
  });

  it('is unavailable without a processed audio asset', () => {
    expect(isTrackAvailable(baseTrack({ processedAudioKey: null }))).toBe(false);
  });

  it('is unavailable when the artist profile is hidden', () => {
    expect(isTrackAvailable(baseTrack({ artist: { ...baseTrack().artist, isHidden: true } }))).toBe(false);
  });

  it('is unavailable when the artist account is suspended or banned', () => {
    const track = baseTrack();
    track.artist.user.status = 'SUSPENDED';
    expect(isTrackAvailable(track)).toBe(false);
  });

  it('is unavailable when the artist relation is missing entirely', () => {
    expect(isTrackAvailable(baseTrack({ artist: null }))).toBe(false);
  });
});

describe('resolveAlbumRelease', () => {
  it('falls back to nothing (client renders "Single") when there is no album or release batch', () => {
    expect(resolveAlbumRelease(baseTrack(), strangerViewer)).toEqual({
      albumTitle: null,
      albumId: null,
      releaseTitle: null,
      releasePlaylistId: null,
    });
  });

  it('prefers a real album title when present', () => {
    const track = baseTrack({ albumId: 'album-1', album: { id: 'album-1', title: 'Night Drives Vol. 1' } });
    expect(resolveAlbumRelease(track, strangerViewer)).toEqual({
      albumTitle: 'Night Drives Vol. 1',
      albumId: 'album-1',
      releaseTitle: null,
      releasePlaylistId: null,
    });
  });

  it('falls back to the originating batch-release playlist title when it is public', () => {
    const track = baseTrack({
      batchItem: {
        target: 'PLAYLIST',
        batch: { playlist: { id: 'release-1', name: 'Debut EP', isPublic: true, creatorId: 'owner-1' } },
      },
    });
    expect(resolveAlbumRelease(track, strangerViewer)).toEqual({
      albumTitle: null,
      albumId: null,
      releaseTitle: 'Debut EP',
      releasePlaylistId: 'release-1',
    });
  });

  it('does not leak a private release playlist title to a non-owner, non-admin viewer', () => {
    const track = baseTrack({
      batchItem: {
        target: 'PLAYLIST',
        batch: { playlist: { id: 'release-1', name: 'Unreleased Drafts', isPublic: false, creatorId: 'owner-1' } },
      },
    });
    expect(resolveAlbumRelease(track, strangerViewer)).toEqual({
      albumTitle: null,
      albumId: null,
      releaseTitle: null,
      releasePlaylistId: null,
    });
    // Not even to an anonymous (no viewer) visitor.
    expect(resolveAlbumRelease(track, null).releaseTitle).toBeNull();
  });

  it('reveals a private release playlist title to its owner and to admins', () => {
    const track = baseTrack({
      batchItem: {
        target: 'PLAYLIST',
        batch: { playlist: { id: 'release-1', name: 'Unreleased Drafts', isPublic: false, creatorId: 'owner-1' } },
      },
    });
    expect(resolveAlbumRelease(track, ownerViewer).releaseTitle).toBe('Unreleased Drafts');
    expect(resolveAlbumRelease(track, adminViewer).releaseTitle).toBe('Unreleased Drafts');
  });

  it('ignores a batch item that was not targeted at a playlist release', () => {
    const track = baseTrack({
      batchItem: { target: 'SINGLE', batch: { playlist: null } },
    });
    expect(resolveAlbumRelease(track, strangerViewer).releaseTitle).toBeNull();
  });
});

describe('sanitizeTrackForSerialization', () => {
  it('strips the raw album/batchItem relations and artist.user.status', () => {
    const track = baseTrack({
      albumId: 'album-1',
      album: { id: 'album-1', title: 'Should Not Leak' },
      batchItem: { target: 'PLAYLIST', batch: { playlist: { id: 'r1', name: 'Should Not Leak Either' } } },
    });
    track.artist.user.status = 'SUSPENDED';
    const sanitized = sanitizeTrackForSerialization(track);
    expect(sanitized.album).toBeUndefined();
    expect(sanitized.batchItem).toBeUndefined();
    expect(sanitized.artist.user.status).toBeUndefined();
    // Non-sensitive fields survive untouched.
    expect(sanitized.artist.user.username).toBe('hyperdrive');
    expect(sanitized.title).toBe('Midnight Drive');
  });
});

describe('buildPlaylistTrackEntry', () => {
  const entry = {
    playlistId: 'playlist-1',
    trackId: 'track-1',
    order: 2,
    addedAt: new Date('2026-07-05T12:00:00Z'),
    track: baseTrack(),
  };

  it('returns the full enriched view for an available track', () => {
    const result = buildPlaylistTrackEntry({
      entry, playlist, viewer: strangerViewer, likedTrackIds: new Set(['track-1']),
    });
    expect(result.playlistTrackId).toBe('playlist-1:track-1');
    expect(result.position).toBe(2);
    expect(result.addedAt).toEqual(entry.addedAt);
    expect(result.addedBy).toEqual({ id: 'owner-1', username: 'owner', displayName: 'Owner' });
    expect(result.track.title).toBe('Midnight Drive');
    expect(result.track.isAvailable).toBe(true);
    expect(result.track.isLiked).toBe(true);
    expect(result.track.albumTitle).toBeNull();
  });

  it('strips all sensitive/display fields for a non-owner viewer when the track is unavailable', () => {
    const hiddenEntry = { ...entry, track: baseTrack({ status: 'HIDDEN' }) };
    const result = buildPlaylistTrackEntry({
      entry: hiddenEntry, playlist, viewer: strangerViewer, likedTrackIds: null,
    });
    expect(result.track).toEqual({ id: 'track-1', isAvailable: false });
    expect(JSON.stringify(result)).not.toMatch(/Midnight Drive|hyperdrive|SUSPENDED|ACTIVE/);
  });

  it('keeps full data (flagged unavailable) for the owner so they can decide whether to remove it', () => {
    const hiddenEntry = { ...entry, track: baseTrack({ status: 'HIDDEN' }) };
    const result = buildPlaylistTrackEntry({
      entry: hiddenEntry, playlist, viewer: ownerViewer, likedTrackIds: null,
    });
    expect(result.track.title).toBe('Midnight Drive');
    expect(result.track.isAvailable).toBe(false);
  });

  it('never leaks artist.user.status even for a fully available track view', () => {
    const result = buildPlaylistTrackEntry({
      entry: { ...entry, track: baseTrack() }, playlist, viewer: strangerViewer, likedTrackIds: null,
    });
    expect(result.track.artist.user.status).toBeUndefined();
    expect(result.track.album).toBeUndefined();
    expect(result.track.batchItem).toBeUndefined();
  });
});
