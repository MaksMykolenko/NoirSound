'use strict';

const { injectMeta, escapeHtml } = require('../lib/metaRenderer');
const { injectLandingDocument } = require('../lib/landingDocument');
const {
  LEGAL_PAGES,
  homeMeta,
  discoverMeta,
  legalMeta,
  trackMeta,
  trackUnavailableMeta,
  artistMeta,
  artistUnavailableMeta,
  playlistMeta,
  playlistUnavailableMeta,
  trimSlash
} = require('../lib/pageMeta');

// The SPA shell is served statically by Caddy. Revalidate its ETag per request
// so a frontend rebuild never leaves backend HTML pointing to old bundle hashes.
const SHELL_ORIGIN = trimSlash(process.env.APP_SHELL_ORIGIN || 'http://web:8080');

const FALLBACK_SHELL =
  '<!doctype html><html lang="en"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<meta name="theme-color" content="#09090b">' +
  '<!--noirsound:ssr-meta--></head>' +
  '<body><div id="root"></div></body></html>';

async function getShell(fastify, shellCache) {
  try {
    const res = await fetch(`${SHELL_ORIGIN}/index.html`, {
      headers: { accept: 'text/html', ...(shellCache.etag ? { 'if-none-match': shellCache.etag } : {}) },
      signal: AbortSignal.timeout(3000)
    });
    if (res.status === 304 && shellCache.html) return shellCache.html;
    if (res.ok) {
      const html = await res.text();
      if (html && /<\/head>/i.test(html) && /<div\s+id=["']root["']/i.test(html)) {
        shellCache.html = html;
        shellCache.etag = res.headers.get('etag');
        return html;
      }
    }
    fastify.log.warn({ status: res.status, origin: SHELL_ORIGIN }, 'meta: unexpected shell response');
  } catch (err) {
    fastify.log.warn({ err: err.message, origin: SHELL_ORIGIN }, 'meta: shell fetch failed');
  }
  // Serve the last good shell if we have one; otherwise a minimal valid shell.
  return shellCache.html || FALLBACK_SHELL;
}

/** Canonical base URL: prefer the configured public URL, else the request host. */
function baseUrl(request) {
  const configured = process.env.PUBLIC_APP_URL && trimSlash(process.env.PUBLIC_APP_URL);
  if (configured) return configured;
  const proto = String(request.headers['x-forwarded-proto'] || request.protocol || 'https')
    .split(',')[0]
    .trim();
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  return `${proto}://${host}`;
}

module.exports = async function pages(fastify) {
  // Cache belongs to this Fastify instance, including isolated test servers.
  const shellCache = { html: null, etag: null };
  async function sendPage(request, reply, meta, landing = false) {
    const shell = await getShell(fastify, shellCache);
    const html = injectMeta(landing ? injectLandingDocument(shell) : shell, meta);
    reply.header('content-type', 'text/html; charset=utf-8');
    reply.header('cache-control', 'no-cache');
    reply.header('x-noirsound-ssr', '1');
    return reply.send(html);
  }

  fastify.get('/', async (request, reply) => sendPage(request, reply, homeMeta(baseUrl(request)), true));

  fastify.get('/discover', async (request, reply) =>
    sendPage(request, reply, discoverMeta(baseUrl(request), request.query.content)));

  fastify.get('/track/:id', async (request, reply) => {
    const base = baseUrl(request);
    let meta;
    try {
      const track = await fastify.prisma.track.findFirst({
        where: {
          id: request.params.id,
          status: 'PUBLISHED',
          isPublic: true,
          artist: { isHidden: false, user: { status: 'ACTIVE' } }
        },
        select: {
          id: true,
          title: true,
          genre: true,
          durationSeconds: true,
          description: true,
          artist: { select: { user: { select: { displayName: true } } } }
        }
      });
      meta = track ? trackMeta(track, base) : trackUnavailableMeta(base, request.params.id);
    } catch (err) {
      fastify.log.error({ err }, 'meta: track lookup failed');
      meta = trackUnavailableMeta(base, request.params.id);
    }
    return sendPage(request, reply, meta);
  });

  fastify.get('/artist/:id', async (request, reply) => {
    const base = baseUrl(request);
    let meta;
    try {
      const artist = await fastify.prisma.artistProfile.findFirst({
        where: { id: request.params.id, isHidden: false, user: { status: 'ACTIVE' } },
        select: { id: true, user: { select: { displayName: true, bio: true, avatarUrl: true } } }
      });
      meta = artist ? artistMeta(artist, base) : artistUnavailableMeta(base, request.params.id);
    } catch (err) {
      fastify.log.error({ err }, 'meta: artist lookup failed');
      meta = artistUnavailableMeta(base, request.params.id);
    }
    return sendPage(request, reply, meta);
  });

  fastify.get('/playlist/:id', async (request, reply) => {
    const base = baseUrl(request);
    let meta;
    try {
      const playlist = await fastify.prisma.playlist.findFirst({
        where: {
          id: request.params.id,
          isPublic: true,
          creator: { status: 'ACTIVE' }
        },
        select: {
          id: true,
          name: true,
          description: true,
          creator: { select: { displayName: true } },
          _count: { select: { tracks: true } }
        }
      });
      meta = playlist ? playlistMeta(playlist, base) : playlistUnavailableMeta(base, request.params.id);
    } catch (err) {
      fastify.log.error({ err }, 'meta: playlist lookup failed');
      meta = playlistUnavailableMeta(base, request.params.id);
    }
    return sendPage(request, reply, meta);
  });

  for (const slug of Object.keys(LEGAL_PAGES)) {
    fastify.get(`/${slug}`, async (request, reply) =>
      sendPage(request, reply, legalMeta(slug, baseUrl(request)))
    );
  }

  // Dynamic sitemap — public/published content only.
  fastify.get('/sitemap.xml', async (request, reply) => {
    const base = trimSlash(baseUrl(request));
    const staticPages = [
      ['/', '1.0'],
      ['/discover', '0.8'],
      ['/terms', '0.3'],
      ['/privacy', '0.3'],
      ['/guidelines', '0.3'],
      ['/copyright', '0.3'],
      ['/abuse', '0.3'],
      ['/creator-rules', '0.3']
    ];

    let tracks = [];
    let artists = [];
    try {
      tracks = await fastify.prisma.track.findMany({
        where: { status: 'PUBLISHED', isPublic: true, artist: { isHidden: false, user: { status: 'ACTIVE' } } },
        select: { id: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 5000
      });
    } catch (err) {
      fastify.log.error({ err }, 'sitemap: track query failed');
    }
    try {
      artists = await fastify.prisma.artistProfile.findMany({
        where: { isHidden: false, user: { status: 'ACTIVE' }, tracks: { some: { status: 'PUBLISHED', isPublic: true } } },
        select: { id: true, updatedAt: true },
        take: 5000
      });
    } catch (err) {
      fastify.log.error({ err }, 'sitemap: artist query failed');
    }

    let playlists = [];
    try {
      playlists = await fastify.prisma.playlist.findMany({
        where: { isPublic: true, creator: { status: 'ACTIVE' } },
        select: { id: true, updatedAt: true },
        take: 5000
      });
    } catch (err) {
      fastify.log.error({ err }, 'sitemap: playlist query failed');
    }

    const loc = (path) => escapeHtml(`${base}${path}`);
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
    for (const [path, priority] of staticPages) {
      lines.push(`  <url><loc>${loc(path)}</loc><priority>${priority}</priority></url>`);
    }
    for (const track of tracks) {
      const lastmod = track.updatedAt ? `<lastmod>${new Date(track.updatedAt).toISOString()}</lastmod>` : '';
      lines.push(`  <url><loc>${loc(`/track/${track.id}`)}</loc>${lastmod}<priority>0.7</priority></url>`);
    }
    for (const artist of artists) {
      const lastmod = artist.updatedAt ? `<lastmod>${new Date(artist.updatedAt).toISOString()}</lastmod>` : '';
      lines.push(`  <url><loc>${loc(`/artist/${artist.id}`)}</loc>${lastmod}<priority>0.6</priority></url>`);
    }
    for (const playlist of playlists) {
      const lastmod = playlist.updatedAt ? `<lastmod>${new Date(playlist.updatedAt).toISOString()}</lastmod>` : '';
      lines.push(`  <url><loc>${loc(`/playlist/${playlist.id}`)}</loc>${lastmod}<priority>0.5</priority></url>`);
    }
    lines.push('</urlset>');

    reply.header('content-type', 'application/xml; charset=utf-8');
    reply.header('cache-control', 'public, max-age=3600');
    return reply.send(lines.join('\n'));
  });
};
