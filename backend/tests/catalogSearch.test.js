import Fastify from 'fastify';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../src/lib/prisma';
import discoverRoutes from '../src/routes/discover';
import tracksRoutes from '../src/routes/tracks';
import artistsRoutes from '../src/routes/artists';
import { seedCatalogFixture } from './fixtures/catalogFixture';

describe('catalog search with real PostgreSQL records', () => {
  let prisma, app, fixture;
  const prefix = `catalog-test-${process.pid}`;
  const normalizedGenre = genre => ({ Electronic: 'electronic', 'Hip-Hop': 'hip_hop' })[genre] || genre;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL_TEST) throw new Error('DATABASE_URL_TEST is required for catalog integration tests.');
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
    prisma = createPrismaClient(); await prisma.$connect();
    fixture = await seedCatalogFixture(prisma, { prefix, now: new Date() });
    app = Fastify({ logger: false }); app.decorate('prisma', prisma); app.decorate('authenticate', async () => {});
    app.decorate('storage', {
      // The database selection is real here; object availability is an explicit
      // storage fixture. End-to-end storage/playback is verified by Playwright.
      getObjectMetadata: async key => ({ exists: key === 'catalog-test/shared.mp3', size: 1000, mimeType: 'audio/mpeg' })
    });
    await app.register(discoverRoutes, { prefix: '/api/discover' });
    await app.register(tracksRoutes, { prefix: '/api/tracks' });
    await app.register(artistsRoutes, { prefix: '/api/artists' });
    await app.ready();
  }, 30000);

  afterAll(async () => {
    if (fixture) await prisma.user.deleteMany({ where: { id: { in: fixture.userIds } } });
    if (app) await app.close(); if (prisma) await prisma.$disconnect();
  });

  async function request(query = {}, path = '/api/discover/catalog') {
    const response = await app.inject({ method: 'GET', url: `${path}?${new URLSearchParams(query)}` });
    expect(response.statusCode, response.body).toBe(200);
    return response.json();
  }
  const ordered = (tracks, sort) => [...tracks].sort((a, b) => {
    const rank = track => sort === 'played' ? track.plays : sort === 'liked' ? track.likes : sort === 'trending' ? track.weeklyPlays : 0;
    const popularity = rank(b) - rank(a); if (popularity) return popularity;
    if (a.publishedAt === null && b.publishedAt !== null) return 1;
    if (a.publishedAt !== null && b.publishedAt === null) return -1;
    const date = Number(b.publishedAt) - Number(a.publishedAt); return date || a.id.localeCompare(b.id, 'en');
  });
  async function traverse(query) {
    const ids = []; let cursor; let pages = 0;
    do {
      const result = await request({ q: prefix, limit: '17', ...query, ...(cursor ? { cursor } : {}) });
      ids.push(...result.items.map(track => track.id));
      expect(result.items.length).toBeLessThanOrEqual(17);
      expect(result.pageInfo.hasNextPage).toBe(Boolean(result.pageInfo.nextCursor));
      cursor = result.pageInfo.nextCursor;
      pages += 1; expect(pages).toBeLessThan(50);
    } while (cursor);
    expect(new Set(ids).size).toBe(ids.length);
    return ids;
  }

  it('selects only bounded, visible, processed Music and Beats for landing without recording a play', async () => {
    const ids = fixture.hiddenTracks.map(track => track.id);
    const playsBefore = await prisma.playEvent.count();
    try {
      // Even if unavailable releases are newer, none can enter the selection.
      await prisma.track.updateMany({ where: { id: { in: ids } }, data: { publishedAt: new Date(Date.now() + 86400000) } });
      const result = await request({ limit: '10000' }, '/api/tracks/showcase');
      for (const contentType of ['MUSIC', 'BEAT']) {
        expect(result.data[contentType]).toHaveLength(3);
        for (const track of result.data[contentType]) {
          expect(track.contentType).toBe(contentType);
          expect(track.isStreamable).toBe(true);
          expect(fixture.publicTracks.some(publicTrack => publicTrack.id === track.id && publicTrack.processedAudioKey)).toBe(true);
          expect(ids).not.toContain(track.id);
          expect(track).not.toHaveProperty('processedAudioKey');
        }
      }
      expect(await prisma.playEvent.count()).toBe(playsBefore);
    } finally {
      for (const track of fixture.hiddenTracks) await prisma.track.update({ where: { id: track.id }, data: { publishedAt: track.publishedAt } });
    }
  });

  it.each(['recent', 'played', 'liked', 'trending'])('traverses every public record exactly once in global %s order including null dates and ties', async sort => {
    const ids = await traverse({ sort });
    expect(ids).toEqual(ordered(fixture.publicTracks, sort).map(track => track.id));
    expect(ids).toHaveLength(320);
  }, 30000);

  it.each(['MUSIC', 'BEAT'])('keeps complete %s pages separate beyond the first 60', async contentType => {
    const ids = await traverse({ contentType });
    expect(ids).toEqual(ordered(fixture.publicTracks.filter(track => track.contentType === contentType), 'recent').map(track => track.id));
    expect(ids).toHaveLength(160);
  }, 30000);

  it('finds a late release, literal special characters, tags and public credits without duplicate joins', async () => {
    const first = await request({ q: prefix, limit: '60' });
    expect(first.items.map(track => track.id)).not.toContain(fixture.lateMusicId);
    for (const [q, expected] of [
      [`${prefix} Late MUSIC`, [fixture.lateMusicId]],
      ['50%_# "quote"', [fixture.lateBeatId, fixture.lateMusicId]],
      ['tag-only-місяць', fixture.publicTracks.filter(track => track.tags.includes('tag-only-місяць')).map(track => track.id)],
      ['Credit-only Żuraw', fixture.publicTracks.filter(track => track.primaryArtistName === 'Credit-only Żuraw').map(track => track.id)],
      ['Featured-only Київ', fixture.publicTracks.filter(track => track.featuredArtists.includes('Featured-only Київ')).map(track => track.id)],
    ]) {
      const result = await request({ q }); expect(result.total).toBe(expected.length);
      expect(new Set(result.items.map(track => track.id))).toEqual(new Set(expected));
    }
    expect((await request({ q: "' OR 1=1 --" })).total).toBe(0);
    expect((await request({ q: 'Producer Żółw', limit: '100' })).total).toBe(160);
  });

  it('resolves taxonomy labels and aliases across legacy and canonical stored genres', async () => {
    for (const genre of ['electronic', 'Electronic']) {
      const result = await request({ q: prefix, contentType: 'MUSIC', genre }); expect(result.total).toBe(80);
      expect(result.items.every(track => normalizedGenre(track.genre) === 'electronic')).toBe(true);
    }
    expect((await request({ q: 'Hip-Hop', contentType: 'BEAT' })).total).toBe(80);
    const grouped = await request({ q: prefix, contentType: 'BEAT', group: 'urban' }); expect(grouped.total).toBe(160);
    const legacyIds = fixture.publicTracks.filter(track => track.genre === 'Electronic' || track.genre === 'Hip-Hop').map(track => track.id);
    for (const genre of ['electronic', 'hip_hop']) {
      const first = await request({ q: prefix, genre, limit: '60' }, '/api/tracks');
      const second = await request({ q: prefix, genre, limit: '60', page: '2' }, '/api/tracks');
      expect(second.data).toHaveLength(20);
      expect([...first.data, ...second.data].some(track => legacyIds.includes(track.id))).toBe(true);
    }
  });

  it('does not strip search punctuation into a genre match and finds actual literal titles', async () => {
    const track = fixture.publicTracks[0];
    const queries = ['rock%', '#rock', 'rock\\'];
    try {
      await prisma.track.update({ where: { id: track.id }, data: { genre: 'rock' } });
      expect((await request({ q: 'rock' })).total).toBeGreaterThan(0);
      for (const q of queries) expect((await request({ q })).total).toBe(0);
      await prisma.track.update({ where: { id: track.id }, data: { title: `${prefix} literal rock% #rock rock\\` } });
      for (const q of queries) {
        const result = await request({ q });
        expect(result.total).toBe(1);
        expect(result.items.map(item => item.id)).toEqual([track.id]);
      }
    } finally {
      await prisma.track.update({ where: { id: track.id }, data: { genre: track.genre, title: track.title } });
    }
  });

  it.each(['recent', 'played'])('keeps legacy %s selections in deterministic order with null dates last', async sort => {
    const expected = ordered(fixture.publicTracks, sort).slice(0, 60).map(track => track.id);
    const result = await request({ q: prefix, sort, limit: '60' }, '/api/tracks');
    expect(result.data.map(track => track.id)).toEqual(expected);
    expect(result.data[0].publishedAt).not.toBeNull();
  });

  it('computes totals and disjunctive option counts from all eligible records', async () => {
    const all = await request({ q: prefix, limit: '1' }); expect(all.total).toBe(320);
    expect(all.facets.genres.filter(option => option.count > 0)).toEqual(expect.arrayContaining([
      { value: 'electronic', label: 'Electronic', count: 80 }, { value: 'jazz', label: 'Jazz', count: 80 },
      { value: 'hip_hop', label: 'Hip-Hop', count: 80 }, { value: 'trap', label: 'Trap', count: 80 },
    ]));
    const result = await request({ q: prefix, contentType: 'BEAT', genre: 'hip_hop', style: 'Trap', mood: 'Dark', bpmMin: '100', bpmMax: '149' });
    const beats = fixture.publicTracks.filter(track => track.contentType === 'BEAT');
    const other = track => track.beatMood === 'Dark' && track.beatBpm >= 100 && track.beatBpm <= 149;
    expect(result.total).toBe(beats.filter(track => normalizedGenre(track.genre) === 'hip_hop' && track.beatStyle === 'Trap' && other(track)).length);
    for (const option of result.facets.styles) expect(option.count).toBe(beats.filter(track => normalizedGenre(track.genre) === 'hip_hop' && track.beatStyle === option.value && other(track)).length);
    for (const option of result.facets.genres) expect(option.count).toBe(beats.filter(track => normalizedGenre(track.genre) === option.value && track.beatStyle === 'Trap' && other(track)).length);
    const bpm = await request({ q: prefix, contentType: 'BEAT', bpm: '120-149', key: 'F# Minor' });
    expect(bpm.total).toBe(beats.filter(track => track.beatKey === 'F# Minor' && track.beatBpm >= 120 && track.beatBpm <= 149).length);
    expect(bpm.facets.bpmRanges.find(option => option.value === 'under-90').count).toBe(beats.filter(track => track.beatKey === 'F# Minor' && track.beatBpm >= 40 && track.beatBpm < 90).length);
  });

  it('does not leak excluded entities through results, search, counts or creator ranking', async () => {
    const result = await request({ q: prefix, limit: '100' });
    expect(result.total).toBe(320);
    expect(result.facets.genres.find(option => option.value === 'phonk').count).toBe(0);
    expect(result.facets.styles.map(option => option.value)).not.toContain('SecretStyle');
    expect((await request({ q: `${prefix} Hidden needle` })).total).toBe(0);
    const artists = await request({ sort: 'trending', limit: '24', hasPublishedTracks: 'true' }, '/api/artists');
    const publicIds = new Set(fixture.publicTracks.map(track => track.artistId));
    expect(artists.data.filter(artist => artist.id.startsWith(prefix)).map(artist => artist.id).sort()).toEqual([...publicIds].sort());
    for (const artist of artists.data.filter(artist => publicIds.has(artist.id))) {
      expect(artist.discoveryPlays).toBe(fixture.publicTracks.filter(track => track.artistId === artist.id).reduce((sum, track) => sum + track.weeklyPlays, 0));
      expect(artist).not.toHaveProperty('monthlyListeners');
      expect(artist.user).not.toHaveProperty('email');
    }
  });

  it('returns lightweight playback-compatible records without private material or full lyrics', async () => {
    const { items } = await request({ q: `${prefix} Late MUSIC` });
    expect(items[0]).toMatchObject({ id: fixture.lateMusicId, contentType: 'MUSIC', isStreamable: true, hasLyrics: true, lyricsType: 'PLAIN' });
    for (const name of ['originalAudioKey', 'processedAudioKey', 'coverImageKey', 'lyricsText', 'lyricsSynced', 'waveformJson', 'description', 'email', 'uploads']) expect(JSON.stringify(items)).not.toContain(`"${name}"`);
    const unstreamable = await request({ q: `${prefix} MUSIC release 153` }); expect(unstreamable.items[0].isStreamable).toBe(false);
  });

  it('rejects an incompatible cursor and invalid requests before SQL execution', async () => {
    const first = await request({ q: prefix, contentType: 'BEAT' });
    for (const query of [{ q: prefix, contentType: 'MUSIC', cursor: first.pageInfo.nextCursor }, { sort: 'DROP TABLE' }, { limit: '101' }, { contentType: 'MUSIC', bpmMin: '90' }, { surprise: 'x' }, { cursor: 'e30' }]) {
      const response = await app.inject({ method: 'GET', url: `/api/discover/catalog?${new URLSearchParams(query)}` }); expect(response.statusCode).toBe(400);
    }
    const duplicate = await app.inject({ method: 'GET', url: '/api/discover/catalog?q=first&q=second' }); expect(duplicate.statusCode).toBe(400);
  });

  it('quiet weekly ranking has zero scores and never substitutes lifetime plays', async () => {
    const zero = fixture.publicTracks.find(track => track.weeklyPlays === 0 && track.oldPlays > 0);
    const result = await request({ q: zero.title, sort: 'trending' });
    expect(result.items[0].rankingScore).toBe(0); expect(result.items[0].plays).toBeGreaterThan(0);
    const legacy = await request({ q: zero.title, sort: 'trending' }, '/api/tracks');
    expect(legacy.data).toEqual([]); expect(legacy.meta.windowDays).toBe(7); expect(legacy.meta).not.toHaveProperty('fallback');
  });

  it('bounds dynamic facet options while retaining the selected rare value and full counts', async () => {
    const ids = fixture.publicTracks.filter(track => track.contentType === 'BEAT').slice(0, 105).map(track => track.id);
    try {
      await prisma.$transaction(ids.map((id, index) => prisma.track.update({ where: { id }, data: { beatStyle: ` Rare ${String(index).padStart(3, '0')} ` } })));
      const selected = await request({ q: prefix, contentType: 'BEAT', style: 'rare 104' });
      expect(selected.total).toBe(1);
      expect(selected.facets.styles.length).toBeLessThanOrEqual(101);
      expect(selected.facets.styles).toContainEqual({ value: 'Rare 104', label: 'Rare 104', count: 1 });
      expect(selected.facets.meta.truncated.styles).toBe(true);
      expect(selected.facets.meta.availableOptions.styles).toBeGreaterThan(100);
    } finally {
      await prisma.$transaction(ids.map(id => prisma.track.update({ where: { id }, data: { beatStyle: fixture.publicTracks.find(track => track.id === id).beatStyle } })));
    }
  }, 30000);
});
