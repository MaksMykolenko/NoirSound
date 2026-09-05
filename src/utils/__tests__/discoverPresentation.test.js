import { describe, expect, it } from 'vitest';
import {
  countGenres,
  madeForYouTracks,
  rankDiscoverCreators,
  rankTrendingTracks,
} from '../discoverPresentation';

const tracks = [
  {
    id: 'new-low',
    title: 'New Low',
    artistId: 'artist-new',
    genre: 'electronic',
    plays: 4,
    likes: 1,
    isStreamable: true,
    status: 'PUBLISHED',
    publishedAt: '2026-08-29T10:00:00.000Z',
  },
  {
    id: 'older-high',
    title: 'Older High',
    artistId: 'artist-high',
    genre: 'Electronic',
    plays: 100,
    likes: 10,
    isStreamable: true,
    status: 'PUBLISHED',
    publishedAt: '2026-08-20T10:00:00.000Z',
  },
  {
    id: 'private-shape',
    title: 'Draft',
    artistId: 'artist-high',
    genre: 'rock',
    plays: 999,
    isStreamable: true,
    status: 'DRAFT',
    publishedAt: '2026-08-30T10:00:00.000Z',
  },
];

describe('Discover presentation selectors', () => {
  it('ranks only public-presentable tracks by real play/like values with deterministic ties', () => {
    expect(rankTrendingTracks(tracks).map((track) => track.id))
      .toEqual(['older-high', 'new-low']);
  });

  it('normalizes duplicate genre spelling into real catalogue counts', () => {
    expect(countGenres(tracks)).toContainEqual({ value: 'electronic', count: 2 });
  });

  it('ranks creators by recent public release activity before existing metrics', () => {
    const creators = [
      { id: 'artist-high', name: 'High', followers: 1000, monthlyListeners: 500 },
      { id: 'artist-new', name: 'New', followers: 2, monthlyListeners: 1 },
    ];
    expect(rankDiscoverCreators(creators, tracks).map((creator) => creator.id))
      .toEqual(['artist-new', 'artist-high']);
  });

  it('builds deterministic recommendations only from actual likes/listens and excludes consumed tracks', () => {
    const catalogue = [
      ...tracks,
      {
        id: 'recommendation',
        title: 'Related',
        artistId: 'artist-new',
        genre: 'electronic',
        plays: 5,
        isStreamable: true,
        status: 'PUBLISHED',
      },
    ];
    expect(madeForYouTracks(catalogue, { likedTrackIds: ['new-low'] }).map((track) => track.id))
      .toEqual(['recommendation', 'older-high']);
    expect(madeForYouTracks(catalogue, { likedTrackIds: [] })).toEqual([]);
  });

  it('uses full liked-track metadata even when the liked release is outside the candidate window', () => {
    const likedOutsideWindow = {
      id: 'old-liked',
      title: 'Old signal',
      artistId: 'artist-signal',
      genre: 'rock',
    };
    const candidates = [
      {
        id: 'same-artist',
        title: 'Same artist',
        artistId: 'artist-signal',
        genre: 'jazz',
        plays: 3,
      },
      {
        id: 'same-genre',
        title: 'Same genre',
        artistId: 'artist-other',
        genre: 'rock',
        plays: 8,
      },
    ];

    expect(madeForYouTracks(candidates, { likedTracks: [likedOutsideWindow] })
      .map((track) => track.id)).toEqual(['same-artist', 'same-genre']);
  });
});
