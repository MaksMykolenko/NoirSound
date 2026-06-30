'use strict';

const { injectMeta, escapeHtml } = require('../lib/metaRenderer');
const {
  LEGAL_PAGES,
  homeMeta,
  legalMeta,
  trackMeta,
  trackUnavailableMeta,
  artistMeta,
  artistUnavailableMeta,
  trimSlash
} = require('../lib/pageMeta');

// The SPA shell is served statically by Caddy. The backend fetches it once and
// caches it so per-route metadata can be injected into the real, hashed build.
const SHELL_ORIGIN = trimSlash(process.env.APP_SHELL_ORIGIN || 'http://web:8080');
const SHELL_TTL_MS = Number(process.env.APP_SHELL_TTL_MS || 60_000);

const FALLBACK_SHELL =
  '<!doctype html><html lang="en"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
  '<body><div id="root"></div></body></html>';

let shellCache = { html: null, ts: 0 };

async function getShell(fastify) {
  const now = Date.now();
  if (shellCache.html && now - shellCache.ts < SHELL_TTL_MS) return shellCache.html;
  try {
    const res = await fetch(`${SHELL_ORIGIN}/index.html`, { headers: { accept: 'text/html' } });
    if (res.ok) {
      const html = await res.text();
      if (html && /<\/head>/i.test(html)) {
        shellCache = { html, ts: now };
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
  async function sendPage(request, reply, meta) {
    const shell = await getShell(fastify);
    const html = injectMeta(shell, meta);
    reply.header('content-type', 'text/html; charset=utf-8');
    reply.header('cache-control', 'public, max-age=300');
    reply.header('x-noirsound-ssr', '1');
    return reply.send(html);
  }

  fastify.get('/', async (request, reply) => sendPage(request, reply, homeMeta(baseUrl(request))));

  fastify.get('/track/:id', async (request, reply) => {
    const base = baseUrl(request);
    let meta;
    try {
      const track = await fastify.prisma.track.findFirst({
        where: {
          id: request.params.id,
          status: 'PUBLISHED',
          artist: { user: { status: 'ACTIVE' } }
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
        where: { id: request.params.id, user: { status: 'ACTIVE' } },
        select: { id: true, user: { select: { displayName: true, bio: true, avatarUrl: true } } }
      });
      meta = artist ? artistMeta(artist, base) : artistUnavailableMeta(base, request.params.id);
    } catch (err) {
      fastify.log.error({ err }, 'meta: artist lookup failed');
      meta = artistUnavailableMeta(base, request.params.id);
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
        where: { status: 'PUBLISHED', artist: { user: { status: 'ACTIVE' } } },
        select: { id: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 5000
      });
    } catch (err) {
      fastify.log.error({ err }, 'sitemap: track query failed');
    }
    try {
      artists = await fastify.prisma.artistProfile.findMany({
        where: { user: { status: 'ACTIVE' }, tracks: { some: { status: 'PUBLISHED' } } },
        select: { id: true, updatedAt: true },
        take: 5000
      });
    } catch (err) {
      fastify.log.error({ err }, 'sitemap: artist query failed');
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
    lines.push('</urlset>');

    reply.header('content-type', 'application/xml; charset=utf-8');
    reply.header('cache-control', 'public, max-age=3600');
    return reply.send(lines.join('\n'));
  });
};
