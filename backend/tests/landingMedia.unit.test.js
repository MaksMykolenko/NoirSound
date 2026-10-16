import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import landingRoutes from '../src/routes/landing';
import gate from '../src/lib/publicAppGate';
import { serializeLandingTrack } from '../src/lib/landingShowcase';

describe('closed landing media boundary', () => {
  let app;
  afterEach(async () => { await app?.close(); vi.unstubAllEnvs(); });
  async function build(track = { processedAudioKey: 'processed/audio.mp3', coverImageKey: 'covers/image.jpg' }, object = { exists: true, size: 100, mimeType: 'audio/mpeg' }) {
    vi.stubEnv('PUBLIC_APP_ENABLED', 'false');
    app = Fastify();
    const findFirst = vi.fn(async () => track);
    const sign = vi.fn(async () => 'https://noirsound.example/signed-private-object');
    app.decorate('prisma', { track: { findFirst, findMany: vi.fn(async () => []) } });
    app.decorate('storage', {
      getObjectMetadata: vi.fn(async key => key === 'processed/audio.mp3' ? object : key.startsWith('image-cache/') ? { exists: true, size: 20, mimeType: 'image/webp' } : { exists: true, size: 100, mimeType: 'image/jpeg' }),
      getObjectStream: vi.fn(async () => Buffer.from('cached-webp')),
      createPresignedGetUrl: sign,
    });
    await app.register(gate);
    await app.register(landingRoutes, { prefix: '/api/landing' });
    app.get('/api/tracks/:id/stream', () => ({ unexpected: true }));
    return { findFirst, sign };
  }
  it.each(['stream', 'cover'])('allows only eligible %s media and leaves catalog blocked', async kind => {
    const { findFirst, sign } = await build();
    const result = await app.inject(`/api/landing/tracks/track-1/${kind}`);
    expect(result.statusCode).toBe(kind === 'stream' ? 302 : 200);
    expect(result.headers['cache-control']).toBe(kind === 'stream' ? 'no-store' : 'private, max-age=300');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: 'track-1', processedAudioKey: { not: null }, NOT: { processedAudioKey: '' },
      status: 'PUBLISHED', isPublic: true, artist: { isHidden: false, user: { status: 'ACTIVE' } }
    } }));
    if (kind === 'stream') expect(sign).toHaveBeenCalledWith('processed/audio.mp3', 300);
    else expect(sign).not.toHaveBeenCalled();
    expect((await app.inject('/api/tracks/track-1/stream')).statusCode).toBe(403);
  });
  it('never signs a noneligible or missing track', async () => {
    const { sign } = await build(null);
    expect((await app.inject('/api/landing/tracks/private/stream')).statusCode).toBe(404);
    expect(sign).not.toHaveBeenCalled();
  });
  it.each([{ exists: false }, { exists: true, size: 0, mimeType: 'audio/mpeg' }, { exists: true, size: 10, mimeType: 'text/html' }])('rejects a processed key whose object is not playable: %j', async object => {
    const { sign } = await build(undefined, object);
    expect((await app.inject('/api/landing/tracks/unready/stream')).statusCode).toBe(404);
    expect(sign).not.toHaveBeenCalled();
  });
  it('keeps unexpected database fields and original object keys out of the showcase DTO', () => {
    const dto = serializeLandingTrack({
      id: 'one', title: 'Public title', contentType: 'MUSIC', originalAudioKey: 'original.wav',
      processedAudioKey: 'processed.mp3', adminNote: 'INTERNAL', futurePrivateField: 'INTERNAL',
      artist: { id: 'artist', adminNote: 'INTERNAL', user: { username: 'creator', displayName: 'Creator', email: 'PRIVATE', passwordHash: 'PRIVATE' } }
    });
    expect(dto).toMatchObject({ id: 'one', title: 'Public title', artist: { user: { username: 'creator' } } });
    expect(JSON.stringify(dto)).not.toMatch(/INTERNAL|PRIVATE|AudioKey|password|email|adminNote|futurePrivateField/);
  });
});
