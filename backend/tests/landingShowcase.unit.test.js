import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import tracksRoutes from '../src/routes/tracks';

const record = (id, contentType = 'MUSIC') => ({
  id, contentType, title: `Release ${id}`, status: 'PUBLISHED', isPublic: true,
  originalAudioKey: `private/${id}.wav`, processedAudioKey: `processed/${id}.mp3`,
  coverImageKey: `covers/${id}.jpg`, lyricsType: 'NONE',
  artist: { id: 'artist-1', user: { displayName: 'Creator', username: 'creator' } }
});

describe('landing showcase HTTP contract', () => {
  let app;
  afterEach(async () => { if (app) await app.close(); });

  async function build(groups = {}, metadata = async () => ({ exists: true, size: 2000, mimeType: 'audio/mpeg' })) {
    const findMany = vi.fn(async ({ where, take }) => (groups[where.contentType] || []).slice(0, take));
    const getObjectMetadata = vi.fn(metadata);
    const getObjectStreamResponse = vi.fn();
    const createPlayEvent = vi.fn();
    app = Fastify();
    app.decorate('authenticate', async () => {});
    app.decorate('prisma', { track: { findMany }, playEvent: { create: createPlayEvent } });
    app.decorate('storage', { getObjectMetadata, getObjectStreamResponse });
    await app.register(tracksRoutes, { prefix: '/api/tracks' });
    return { findMany, getObjectMetadata, getObjectStreamResponse, createPlayEvent };
  }

  it('returns at most three per type using public author visibility and the existing safe track serializer', async () => {
    const handles = await build({ MUSIC: Array.from({ length: 15 }, (_, i) => record(`music-${i}`)), BEAT: [record('beat-0', 'BEAT')] });
    const response = await app.inject('/api/tracks/showcase?limit=10000&contentType=ALL');
    expect(response.statusCode).toBe(200);
    expect(response.json().data.MUSIC.map(track => track.id)).toEqual(['music-0', 'music-1', 'music-2']);
    expect(response.json().data.BEAT.map(track => track.id)).toEqual(['beat-0']);
    for (const contentType of ['MUSIC', 'BEAT']) {
      expect(handles.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          contentType, status: 'PUBLISHED', isPublic: true,
          artist: { isHidden: false, user: { status: 'ACTIVE' } },
          processedAudioKey: { not: null }, NOT: { processedAudioKey: '' }
        }, take: 12
      }));
    }
    const track = response.json().data.MUSIC[0];
    expect(track.isStreamable).toBe(true);
    expect(track.hasCoverImage).toBe(true);
    expect(response.body).not.toMatch(/originalAudioKey|processedAudioKey|coverImageKey|private\/|processed\//);
    expect(handles.getObjectMetadata).toHaveBeenCalledTimes(4);
    expect(handles.getObjectStreamResponse).not.toHaveBeenCalled();
    expect(handles.createPlayEvent).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('excludes missing, empty, and non-audio processed objects without inventing tracks or opening streams', async () => {
    const states = [{ exists: false }, { exists: true, size: 0, mimeType: 'audio/mpeg' }, { exists: true, size: 20, mimeType: 'text/html' }, { exists: true, size: 100, mimeType: 'audio/mpeg' }];
    const handles = await build({ MUSIC: states.map((_, i) => record(String(i))) }, async key => states[Number(key.match(/\/(\d+)/)[1])]);
    const response = await app.inject('/api/tracks/showcase');
    expect(response.json().data).toMatchObject({ MUSIC: [{ id: '3', isStreamable: true }], BEAT: [] });
    expect(response.json().data.MUSIC).toHaveLength(1);
    expect(handles.getObjectStreamResponse).not.toHaveBeenCalled();
  });

  it('bounds object checks when the candidate window has no available audio', async () => {
    const handles = await build({ MUSIC: Array.from({ length: 99 }, (_, i) => record(String(i))) }, async () => ({ exists: false }));
    const response = await app.inject('/api/tracks/showcase');
    expect(response.json()).toEqual({ data: { MUSIC: [], BEAT: [] } });
    expect(handles.getObjectMetadata).toHaveBeenCalledTimes(12);
  });

  it('returns an honest service error when storage fails', async () => {
    await build({ MUSIC: [record('one')] }, async () => { throw new Error('unavailable'); });
    const response = await app.inject('/api/tracks/showcase');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'SHOWCASE_UNAVAILABLE' });
  });

  it('returns an honest service error when the database fails', async () => {
    const handles = await build();
    handles.findMany.mockRejectedValue(new Error('unavailable'));
    const response = await app.inject('/api/tracks/showcase');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'SHOWCASE_UNAVAILABLE' });
  });
});
