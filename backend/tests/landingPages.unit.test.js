import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pages from '../src/routes/pages';

const shell = (hash = 'first') => `<!doctype html><html lang="en"><head><!--noirsound:ssr-meta--><title>Old</title><script type="module" src="/assets/index-${hash}.js"></script></head><body><div id="root"></div></body></html>`;
const response = (hash = 'first') => new Response(shell(hash), { headers: { etag: `"${hash}"` } });

describe('landing initial HTTP document and existing metadata routes', () => {
  let app;
  afterEach(async () => { if (app) await app.close(); vi.unstubAllGlobals(); });

  async function build() {
    vi.stubGlobal('fetch', vi.fn(async () => response()));
    app = Fastify();
    app.decorate('prisma', {
      track: { findFirst: vi.fn(async () => ({ id: 'track-1', title: 'Real release', artist: { user: { displayName: 'Creator' } } })), findMany: vi.fn(async () => [{ id: 'track-1' }]) },
      artistProfile: { findFirst: vi.fn(async () => ({ id: 'artist-1', user: { displayName: 'Real artist' } })), findMany: vi.fn(async () => [{ id: 'artist-1' }]) },
      playlist: { findFirst: vi.fn(async () => ({ id: 'playlist-1', name: 'Real playlist', creator: { displayName: 'Creator' } })), findMany: vi.fn(async () => [{ id: 'playlist-1' }]) }
    });
    await app.register(pages);
  }

  it('serves readable root content and real CTA links before JavaScript with one canonical and social metadata set', async () => {
    await build();
    const result = await app.inject({ url: '/', headers: { host: 'noirsound.co', 'x-forwarded-proto': 'https' } });
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<title>NoirSound — your sound</title>');
    expect(result.body).toContain('<h1>Your sound.</h1>');
    for (const path of ['/discover', '/discover?content=MUSIC', '/discover?content=BEAT', '/upload']) expect(result.body).toContain(`href="${path}"`);
    expect(result.body.match(/<title>/g)).toHaveLength(1);
    expect(result.body.match(/rel="canonical"/g)).toHaveLength(1);
    expect(result.body.match(/property="og:title"/g)).toHaveLength(1);
    expect(result.body.match(/name="twitter:title"/g)).toHaveLength(1);
    expect(result.body).toContain('href="https://noirsound.co/"');
    expect(result.body).toContain('/assets/index-first.js');
  });

  it.each([
    ['/discover?content=BEAT', 'Beats — Discover | NoirSound'],
    ['/track/track-1', 'Real release — Creator | NoirSound'],
    ['/artist/artist-1', 'Real artist — NoirSound'],
    ['/playlist/playlist-1', 'Real playlist — Playlist by Creator | NoirSound'],
    ['/terms', 'Terms of Service — NoirSound']
  ])('preserves %s metadata without inserting landing content into app routes', async (url, title) => {
    await build();
    const result = await app.inject(url);
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain(`<title>${title}</title>`);
    expect(result.body).not.toContain('landing-initial');
    expect(result.body).not.toContain('<h1>Your sound.</h1>');
    expect(result.body).toContain('<div id="root"></div>');
  });

  it('revalidates the current shell and adopts new bundle hashes immediately after a web rebuild', async () => {
    await build();
    fetch.mockResolvedValueOnce(response('first'))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(response('rebuilt'));
    expect((await app.inject('/')).body).toContain('/assets/index-first.js');
    expect((await app.inject('/discover')).body).toContain('/assets/index-first.js');
    expect(fetch.mock.calls[1][1].headers['if-none-match']).toBe('"first"');
    const afterBuild = await app.inject('/');
    expect(afterBuild.body).toContain('/assets/index-rebuilt.js');
    expect(afterBuild.body).not.toContain('/assets/index-first.js');
    expect(afterBuild.headers['cache-control']).toBe('no-cache');
  });

  it('keeps a readable root and metadata when the shell origin is unavailable', async () => {
    await build();
    fetch.mockRejectedValue(new Error('offline'));
    const result = await app.inject('/');
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<h1>Your sound.</h1>');
    expect(result.body).toContain('href="/upload"');
    expect(result.body).toContain('<title>NoirSound — your sound</title>');
  });

  it('keeps the public sitemap content and escaped canonical origin', async () => {
    await build();
    const result = await app.inject('/sitemap.xml');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toContain('application/xml');
    for (const path of ['/discover', '/track/track-1', '/artist/artist-1', '/playlist/playlist-1', '/terms']) expect(result.body).toContain(`${path}</loc>`);
  });
});
