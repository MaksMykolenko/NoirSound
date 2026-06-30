'use strict';

/**
 * Pure HTML metadata renderer for server-side injection into the SPA shell.
 *
 * Social crawlers (Telegram, WhatsApp, Discord, X, Facebook) read the initial
 * HTML response and do not execute React. These helpers take the built
 * `index.html` shell and inject route-specific <head> metadata. All values are
 * HTML-escaped — track titles, artist names and bios are user-generated and
 * must never be able to break out of an attribute or inject markup.
 *
 * This module is intentionally dependency-free and side-effect-free so it can
 * be unit-tested without a database, network, or live shell.
 */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Serialize an object for embedding in a <script type="application/ld+json">. */
function escapeJsonLd(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function metaName(name, content) {
  if (content == null || content === '') return '';
  return `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">`;
}

function metaProp(property, content) {
  if (content == null || content === '') return '';
  return `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}">`;
}

/** Build the route-specific <head> tags as an HTML string. */
function buildMetaTags(meta = {}) {
  const ogTitle = meta.ogTitle || meta.title;
  const out = [];

  if (meta.title) out.push(`<title>${escapeHtml(meta.title)}</title>`);
  out.push(metaName('description', meta.description));
  if (meta.robots) out.push(metaName('robots', meta.robots));
  if (meta.canonical) out.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`);

  out.push(metaProp('og:type', meta.type || 'website'));
  out.push(metaProp('og:site_name', meta.siteName || 'NoirSound'));
  out.push(metaProp('og:title', ogTitle));
  out.push(metaProp('og:description', meta.description));
  out.push(metaProp('og:url', meta.url || meta.canonical));
  if (meta.image) {
    out.push(metaProp('og:image', meta.image));
    out.push(metaProp('og:image:secure_url', meta.image));
    if (meta.imageType) out.push(metaProp('og:image:type', meta.imageType));
    if (meta.imageWidth) out.push(metaProp('og:image:width', String(meta.imageWidth)));
    if (meta.imageHeight) out.push(metaProp('og:image:height', String(meta.imageHeight)));
    if (meta.imageAlt) out.push(metaProp('og:image:alt', meta.imageAlt));
  }

  out.push(metaName('twitter:card', meta.twitterCard || 'summary_large_image'));
  out.push(metaName('twitter:title', ogTitle));
  out.push(metaName('twitter:description', meta.description));
  if (meta.image) {
    out.push(metaName('twitter:image', meta.image));
    if (meta.imageAlt) out.push(metaName('twitter:image:alt', meta.imageAlt));
  }

  if (meta.jsonLd) {
    const blocks = Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd];
    for (const block of blocks) {
      out.push(`<script type="application/ld+json">${escapeJsonLd(block)}</script>`);
    }
  }

  return out.filter(Boolean).join('\n    ');
}

// Managed tags we replace so the static defaults never duplicate or override
// the route-specific values we inject.
const STRIP_PATTERNS = [
  /<title>[\s\S]*?<\/title>/i,
  /<meta\s+name=["']description["'][^>]*>/gi,
  /<meta\s+name=["']robots["'][^>]*>/gi,
  /<link\s+rel=["']canonical["'][^>]*>/gi,
  /<meta\s+property=["']og:[^"']*["'][^>]*>/gi,
  /<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi,
  /<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi
];

/**
 * Inject route metadata into a shell HTML string. Removes any existing managed
 * tags first (idempotent), then inserts the fresh block before </head>.
 */
function injectMeta(shellHtml, meta = {}) {
  let html = String(shellHtml || '');
  for (const pattern of STRIP_PATTERNS) {
    html = html.replace(pattern, '');
  }
  const block = buildMetaTags(meta);
  const insertion = `    <!--noirsound:ssr-meta-->\n    ${block}\n  `;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${insertion}</head>`);
  }
  // Degenerate shell without a <head>: still emit valid, crawlable HTML.
  return `<!doctype html><html><head>\n${block}\n</head><body><div id="root"></div></body></html>`;
}

module.exports = { escapeHtml, escapeJsonLd, buildMetaTags, injectMeta };
