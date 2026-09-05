import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseDiscoverQuery } from '../src/lib/discoverQuery';
import tracksRoutes from '../src/routes/tracks';

function publicTrack(overrides = {}) {
  return {
    id: 'track-1',
    title: 'Night Signal',
    status: 'PUBLISHED',
    isPublic: true,
    contentType: 'MUSIC',
    processedAudioKey: 'processed/night-signal.mp3',
    coverImageKey: null,
    lyricsType: 'NONE',
    lyricsRightsConfirmed: false,
    plays: 10,
    likes: 2,
    artistId: 'artist-1',
    artist: {
      isHidden: false,
      user: { status: 'ACTIVE', displayName: 'Signal Maker', username: 'signal-maker' },
    },
    ...overrides,
  };
}

async function buildApp({ tracks = [], ranked = [] } = {}) {
  const findMany = vi.fn(async ({ where }) => {
    if (where?.id?.in) {
      return tracks.filter((track) => where.id.in.includes(track.id));
    }
    return tracks;
  });
  const groupBy = vi.fn(async ({ skip = 0, take = ranked.length }) => ranked.slice(skip, skip + take));
  const app = Fastify({ logger: false });
  app.decorate('authenticate', async () => {});
  app.decorate('prisma', {
    track: { findMany, findFirst: vi.fn() },
    playEvent: { groupBy },
  });
  await app.register(tracksRoutes, { prefix: '/api/tracks' });
  await app.ready();
  return { app, findMany, groupBy };
}

describe('Discover catalogue query parsing', () => {
  it('normalizes pagination, sorting, and Beat BPM ranges', () => {
    expect(parseDiscoverQuery({
      sort: 'PLAYED',
      limit: '48',
      page: '2',
      bpm: '120-149',
      style: ' Trap ',
      key: 'F# Minor',
    })).toEqual({
      ok: true,
      value: {
        sort: 'played',
        limit: 48,
        page: 2,
        skip: 48,
        bpm: '120-149',
        bpmWhere: { gte: 120, lte: 149 },
        style: 'Trap',
        mood: null,
        key: 'F# Minor',
        genre: null,
        group: null,
        groupGenres: null,
      },
    });
  });

  it.each([
    [{ limit: '0' }, 'DISCOVER_QUERY_INVALID'],
    [{ limit: '61' }, 'DISCOVER_QUERY_INVALID'],
    [{ page: '-1' }, 'DISCOVER_QUERY_INVALID'],
    [{ sort: 'viral' }, 'DISCOVER_SORT_INVALID'],
    [{ bpm: '120-150' }, 'BEAT_BPM_FILTER_INVALID'],
    [{ genre: 'definitely-not-a-genre' }, 'DISCOVER_GENRE_FILTER_INVALID'],
    [{ group: 'not-a-group' }, 'DISCOVER_GENRE_GROUP_INVALID'],
    [{ genre: 'rap', group: 'urban' }, 'DISCOVER_TAXONOMY_FILTER_CONFLICT'],
  ])('rejects unsupported query input before Prisma (%o)', (query, error) => {
    expect(parseDiscoverQuery(query)).toMatchObject({ ok: false, error });
  });
});

describe('Discover public catalogue route', () => {
  let app;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (app) await app.close();
    app = null;
  });

  it('applies Beat facets, pagination, and played ordering before the bounded query', async () => {
    const built = await buildApp({
      tracks: [publicTrack({ contentType: 'BEAT', beatBpm: 132, beatKey: 'F# Minor' })],
    });
    ({ app } = built);
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks?contentType=BEAT&style=Trap&mood=Dark&key=F%23%20Minor&bpm=120-149&sort=played&limit=12&page=2',
    });

    expect(response.statusCode).toBe(200);
    expect(built.findMany).toHaveBeenCalledTimes(1);
    expect(built.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'PUBLISHED',
        isPublic: true,
        contentType: 'BEAT',
        beatStyle: { contains: 'Trap', mode: 'insensitive' },
        beatMood: { contains: 'Dark', mode: 'insensitive' },
        beatKey: { equals: 'F# Minor', mode: 'insensitive' },
        beatBpm: { gte: 120, lte: 149 },
        artist: { isHidden: false, user: { status: 'ACTIVE' } },
      }),
      orderBy: [
        { plays: 'desc' },
        { publishedAt: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
      skip: 12,
      take: 12,
    }));
  });

  it('uses published/public/visible Music predicates without Beat metadata filters', async () => {
    const built = await buildApp({ tracks: [publicTrack()] });
    ({ app } = built);
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks?contentType=MUSIC&sort=recent',
    });

    expect(response.statusCode).toBe(200);
    expect(built.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: 'PUBLISHED',
        isPublic: true,
        contentType: 'MUSIC',
        artist: { isHidden: false, user: { status: 'ACTIVE' } },
      },
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      skip: 0,
      take: 20,
    }));
  });

  it('ranks trending from qualified events in a seven-day public window without N+1 queries', async () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
    const built = await buildApp({
      tracks: [
        publicTrack({ id: 'track-1', plays: 10 }),
        publicTrack({ id: 'track-2', plays: 20 }),
      ],
      ranked: [
        { trackId: 'track-2', _count: { trackId: 5 } },
        { trackId: 'track-1', _count: { trackId: 3 } },
      ],
    });
    ({ app } = built);
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks?sort=trending&limit=8',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((track) => track.id)).toEqual(['track-2', 'track-1']);
    expect(response.json().meta).toEqual({ page: 1, limit: 8, sort: 'trending', windowDays: 7 });
    expect(built.groupBy).toHaveBeenCalledWith({
      by: ['trackId'],
      where: {
        qualified: true,
        createdAt: { gte: new Date('2026-08-22T12:00:00.000Z') },
        track: {
          status: 'PUBLISHED',
          isPublic: true,
          artist: { isHidden: false, user: { status: 'ACTIVE' } },
        },
      },
      _count: { trackId: true },
      orderBy: [
        { _count: { trackId: 'desc' } },
        { trackId: 'asc' },
      ],
      skip: 0,
      take: 8,
    });
    expect(built.findMany).toHaveBeenCalledTimes(1);
  });

  it('applies a canonical genre group before pagination', async () => {
    const built = await buildApp({ tracks: [publicTrack({ genre: 'rap' })] });
    ({ app } = built);
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks?contentType=MUSIC&group=urban&limit=12',
    });

    expect(response.statusCode).toBe(200);
    expect(built.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        contentType: 'MUSIC',
        genre: { in: expect.arrayContaining(['hip_hop', 'hip-hop', 'rap', 'trap', 'phonk']), mode: 'insensitive' },
      }),
      skip: 0,
      take: 12,
    }));
  });

  it('returns an empty later weekly page instead of switching ranking algorithms', async () => {
    const built = await buildApp({
      tracks: [publicTrack({ id: 'track-1' }), publicTrack({ id: 'track-2' })],
      ranked: [
        { trackId: 'track-1', _count: { trackId: 4 } },
        { trackId: 'track-2', _count: { trackId: 2 } },
      ],
    });
    ({ app } = built);
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks?sort=trending&limit=1&page=3',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [],
      meta: { page: 3, limit: 1, sort: 'trending', windowDays: 7 },
    });
    expect(built.groupBy).toHaveBeenCalledTimes(1);
    expect(built.findMany).not.toHaveBeenCalled();
  });

  it('keeps a quiet weekly ranking empty without substituting lifetime totals', async () => {
    const built = await buildApp({ tracks: [publicTrack()], ranked: [] });
    ({ app } = built);
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks?sort=trending',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().meta).toMatchObject({
      sort: 'trending',
      windowDays: 7,
    });
    expect(response.json().data).toEqual([]);
    expect(response.json().meta).not.toHaveProperty('fallback');
    expect(built.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['/api/tracks?style=Trap', 'BEAT_FILTER_REQUIRES_BEAT_CONTENT'],
    ['/api/tracks?contentType=MUSIC&bpm=120-149', 'BEAT_FILTER_REQUIRES_BEAT_CONTENT'],
    ['/api/tracks?contentType=BEAT&bpm=120-150', 'BEAT_BPM_FILTER_INVALID'],
    ['/api/tracks?sort=viral', 'DISCOVER_SORT_INVALID'],
    ['/api/tracks?group=nope', 'DISCOVER_GENRE_GROUP_INVALID'],
    ['/api/tracks?limit=61', 'DISCOVER_QUERY_INVALID'],
  ])('rejects invalid public filters without querying: %s', async (url, error) => {
    const built = await buildApp({ tracks: [publicTrack()] });
    ({ app } = built);
    const response = await app.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error });
    expect(built.findMany).not.toHaveBeenCalled();
    expect(built.groupBy).not.toHaveBeenCalled();
  });
});
