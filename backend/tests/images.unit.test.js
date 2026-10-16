import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import imageService from '../src/services/images.js';

const source = readFileSync(new URL('../../public/images/cover_electronic.png', import.meta.url));
function storageFixture() {
  const objects = new Map([['cover.png', source]]);
  return {
    getObjectMetadata: vi.fn(async key => objects.has(key) ? {
      exists: true, size: objects.get(key).length, mimeType: key.endsWith('.png') ? 'image/png' : 'image/webp', etag: 'source-v1',
    } : { exists: false }),
    getObjectStream: vi.fn(async key => objects.get(key)),
    putObject: vi.fn(async (key, bytes) => objects.set(key, bytes)),
  };
}

describe('optimized image delivery', () => {
  it('reuses one compressed derivative across simultaneous requests and subsequent visits', async () => {
    const storage = storageFixture();
    const [first, simultaneous] = await Promise.all([
      imageService.getOptimizedImage(storage, 'cover.png'), imageService.getOptimizedImage(storage, 'cover.png'),
    ]);
    expect(first.mimeType).toBe('image/webp');
    expect(first.body.subarray(0, 4).toString()).toBe('RIFF');
    expect(first.body.length).toBeLessThan(source.length / 3);
    expect(simultaneous.body).toEqual(first.body);
    const cached = await imageService.getOptimizedImage(storage, 'cover.png');
    expect(cached.body).toEqual(first.body);
    expect(storage.putObject).toHaveBeenCalledOnce();
  });

  it('sets browser caching and revalidates with ETag without sharing private covers', async () => {
    const storage = storageFixture();
    const app = Fastify();
    app.get('/cover', (req, reply) => imageService.sendCoverImage(storage, 'cover.png', req, reply));
    try {
      const response = await app.inject('/cover');
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('private, max-age=300');
      expect(response.headers['content-type']).toBe('image/webp');
      const cached = await app.inject({ url: '/cover', headers: { 'if-none-match': response.headers.etag } });
      expect(cached.statusCode).toBe(304);
      expect(cached.rawPayload.length).toBe(0);
    } finally { await app.close(); }
  });

  it('queues a grid of different uncached covers instead of returning their large originals', async () => {
    const storage = storageFixture();
    await storage.putObject('second.png', source);
    await storage.putObject('third.png', source);
    const images = await Promise.all(['cover.png', 'second.png', 'third.png'].map(key => imageService.getOptimizedImage(storage, key)));
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(image.mimeType).toBe('image/webp');
      expect(image.body.length).toBeLessThan(source.length / 3);
    }
  });

  it('still serves the original when derivative storage is unavailable', async () => {
    const storage = storageFixture();
    storage.putObject.mockRejectedValue(new Error('cache unavailable'));
    const app = Fastify();
    app.get('/cover', (req, reply) => imageService.sendCoverImage(storage, 'cover.png', req, reply));
    try {
      const response = await app.inject('/cover');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.rawPayload).toEqual(source);
    } finally { await app.close(); }
  });
});
