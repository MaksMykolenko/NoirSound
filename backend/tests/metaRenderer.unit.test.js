/**
 * Metadata renderer + page-meta builder unit tests (no database, no network).
 * Run: npx vitest run tests/metaRenderer.unit.test.js
 */
import { describe, it, expect } from 'vitest';
import { escapeHtml, buildMetaTags, injectMeta } from '../src/lib/metaRenderer.js';
import {
  homeMeta,
  legalMeta,
  trackMeta,
  trackUnavailableMeta,
  artistMeta,
  artistUnavailableMeta,
  isoDuration,
  humanDuration,
  genreLabel
} from '../src/lib/pageMeta.js';

const BASE = 'https://noirsound.co';
// Mirrors the real built shell: charset/viewport/theme-color, then the
// <!--noirsound:ssr-meta--> marker with the static defaults, THEN the theme
// script, favicon, preconnect, module script, modulepreload, and CSS bundle
// that Vite appends at build time. Shaped this way so tests actually exercise
// the head-placement bug (metadata landing after scripts/fonts/CSS) instead
// of a shell that never had that problem.
const SHELL =
  '<!doctype html><html lang="en"><head>' +
  '<meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<meta name="theme-color" content="#09090b">' +
  '<!--noirsound:ssr-meta-->' +
  '<title>Old Title</title>' +
  '<meta name="description" content="old">' +
  '<meta property="og:title" content="old og">' +
  '<link rel="canonical" href="https://old/">' +
  '<script type="application/ld+json">{"@type":"WebSite"}</script>' +
  '<script>/* theme init */</script>' +
  '<link rel="icon" href="/favicon.svg">' +
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">' +
  '<script type="module" crossorigin src="/assets/index-abc.js"></script>' +
  '<link rel="modulepreload" crossorigin href="/assets/vendor-xyz.js">' +
  '<link rel="stylesheet" crossorigin href="/assets/index-def.css">' +
  '</head><body><div id="root"></div></body></html>';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<script>"&'`)).toBe('&lt;script&gt;&quot;&amp;&#39;');
  });
});

describe('buildMetaTags', () => {
  it('emits OG, Twitter, canonical, and JSON-LD', () => {
    const html = buildMetaTags(homeMeta(BASE));
    expect(html).toContain('<meta property="og:title" content="NoirSound — Creator-first music platform">');
    expect(html).toContain('<meta property="og:image" content="https://noirsound.co/og/noirsound-cover.png">');
    expect(html).toContain('<meta property="og:image:secure_url" content="https://noirsound.co/og/noirsound-cover.png">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<link rel="canonical" href="https://noirsound.co/">');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"WebSite"');
  });
});

describe('injectMeta', () => {
  it('replaces the existing managed tags (no duplicates, keeps the app script)', () => {
    const out = injectMeta(SHELL, homeMeta(BASE));
    // Old values are gone.
    expect(out).not.toContain('<title>Old Title</title>');
    expect(out).not.toContain('content="old og"');
    expect(out).not.toContain('href="https://old/"');
    // Exactly one canonical + one title.
    expect(out.match(/<link rel="canonical"/g)).toHaveLength(1);
    expect(out.match(/<title>/g)).toHaveLength(1);
    // The SPA bundle is preserved so the page still boots for real users.
    expect(out).toContain('/assets/index-abc.js');
    expect(out).toContain('<div id="root"></div>');
  });

  it('places metadata at the ssr-meta marker, before scripts/fonts/preload/CSS', () => {
    const out = injectMeta(SHELL, homeMeta(BASE));
    const markerIndex = out.indexOf('<!--noirsound:ssr-meta-->');
    const titleIndex = out.indexOf('<title>');
    const ogIndex = out.indexOf('<meta property="og:title"');
    const themeScriptIndex = out.indexOf('/* theme init */');
    const faviconIndex = out.indexOf('rel="icon"');
    const preconnectIndex = out.indexOf('rel="preconnect"');
    const moduleScriptIndex = out.indexOf('/assets/index-abc.js');
    const modulePreloadIndex = out.indexOf('modulepreload');
    const cssIndex = out.indexOf('/assets/index-def.css');

    // Marker survives exactly once and immediately precedes the fresh block.
    expect(out.match(/<!--noirsound:ssr-meta-->/g)).toHaveLength(1);
    expect(titleIndex).toBeGreaterThan(markerIndex);

    // Every scripted/linked asset comes AFTER the metadata block — this is
    // the actual bug being fixed: crawlers must see OG/Twitter tags before
    // any script, font preconnect, modulepreload, or stylesheet.
    for (const assetIndex of [themeScriptIndex, faviconIndex, preconnectIndex, moduleScriptIndex, modulePreloadIndex, cssIndex]) {
      expect(assetIndex).toBeGreaterThan(ogIndex);
    }
  });

  it('falls back to right after <head> when the marker is missing (no append-before-</head>)', () => {
    const noMarkerShell = SHELL.replace('<!--noirsound:ssr-meta-->', '');
    const out = injectMeta(noMarkerShell, homeMeta(BASE));
    const headOpenIndex = out.indexOf('<head>');
    const titleIndex = out.indexOf('<title>');
    const moduleScriptIndex = out.indexOf('/assets/index-abc.js');
    expect(titleIndex).toBeGreaterThan(headOpenIndex);
    expect(titleIndex).toBeLessThan(moduleScriptIndex);
  });

  it('is idempotent across repeated injections (no marker drift, no duplicate blocks)', () => {
    const once = injectMeta(SHELL, homeMeta(BASE));
    const twice = injectMeta(once, homeMeta(BASE));
    expect(twice.match(/<!--noirsound:ssr-meta-->/g)).toHaveLength(1);
    expect(twice.match(/<title>/g)).toHaveLength(1);
    expect(twice.match(/<link rel="canonical"/g)).toHaveLength(1);
    expect(twice).toContain('/assets/index-abc.js');
  });

  it('collapses blank lines left behind by stripped tags', () => {
    const out = injectMeta(SHELL, homeMeta(BASE));
    expect(out).not.toMatch(/\n[ \t]*\n[ \t]*\n/);
  });

  it('escapes user-generated values — no markup injection from a malicious title', () => {
    const evil = {
      ...trackMeta(
        { id: 't1', title: '</title><script>alert(1)</script>', genre: 'lofi', durationSeconds: 90, artist: { user: { displayName: 'A" onerror="x' } } },
        BASE
      )
    };
    const out = injectMeta(SHELL, evil);
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;');
    // The attacker double-quote cannot break out of an attribute.
    expect(out).not.toContain('onerror="x"');
    expect(out).toContain('&quot; onerror=&quot;x');
  });
});

describe('homeMeta', () => {
  it('is the canonical site default', () => {
    const m = homeMeta(BASE);
    expect(m.title).toBe('NoirSound — Creator-first music platform');
    expect(m.canonical).toBe('https://noirsound.co/');
    expect(m.image).toBe('https://noirsound.co/og/noirsound-cover.png');
    expect(m.jsonLd['@type']).toBe('WebSite');
  });
});

describe('legalMeta', () => {
  it('builds per-page legal metadata', () => {
    expect(legalMeta('terms', BASE).title).toBe('Terms of Service — NoirSound');
    expect(legalMeta('privacy', BASE).canonical).toBe('https://noirsound.co/privacy');
  });
  it('returns null for unknown slugs', () => {
    expect(legalMeta('does-not-exist', BASE)).toBeNull();
  });
});

describe('trackMeta', () => {
  const track = {
    id: 'trk_123',
    title: 'Midnight Drive',
    genre: 'synthwave',
    durationSeconds: 118,
    description: 'A neon-lit late night cruise.',
    artist: { user: { displayName: 'Nova' } }
  };
  it('uses real title, artist, genre, duration, and the controlled cover route', () => {
    const m = trackMeta(track, BASE);
    expect(m.title).toBe('Midnight Drive — Nova | NoirSound');
    expect(m.type).toBe('music.song');
    expect(m.url).toBe('https://noirsound.co/track/trk_123');
    expect(m.image).toBe('https://noirsound.co/api/public/covers/trk_123');
    expect(m.description).toContain('Synthwave');
    expect(m.description).toContain('1:58');
    expect(m.jsonLd['@type']).toBe('MusicRecording');
    expect(m.jsonLd.duration).toBe('PT1M58S');
    expect(m.jsonLd.byArtist.name).toBe('Nova');
  });

  it('uses the canonical English label (with correct punctuation) in both the OG description and JSON-LD genre', () => {
    const m = trackMeta({ ...track, genre: 'hip_hop', description: '' }, BASE);
    // Regression guard: a naive `replace(/[_-]+/g,' ')` humanizer would produce
    // "Hip Hop" (missing the hyphen). Must match the on-site label exactly.
    expect(m.description).toContain('Hip-Hop');
    expect(m.description).not.toContain('Hip Hop ');
    expect(m.jsonLd.genre).toBe('Hip-Hop');
  });
});

describe('unavailable / suspended fallbacks', () => {
  it('track unavailable is generic + noindex', () => {
    const m = trackUnavailableMeta(BASE, 'x');
    expect(m.title).toBe('Track unavailable — NoirSound');
    expect(m.robots).toBe('noindex');
    expect(m.image).toBe('https://noirsound.co/og/default-track.png');
  });
  it('artist unavailable is generic + noindex', () => {
    const m = artistUnavailableMeta(BASE, 'x');
    expect(m.title).toBe('Artist unavailable — NoirSound');
    expect(m.robots).toBe('noindex');
  });
});

describe('artistMeta', () => {
  it('uses display name and default image when no avatar; never exposes role', () => {
    const m = artistMeta({ id: 'art_1', user: { displayName: 'Nova', role: 'ADMIN', avatarUrl: null } }, BASE);
    expect(m.title).toBe('Nova — NoirSound');
    expect(m.type).toBe('profile');
    expect(m.image).toBe('https://noirsound.co/og/default-artist.png');
    expect(JSON.stringify(m)).not.toContain('ADMIN');
  });
  it('uses an absolute avatar URL when present', () => {
    const m = artistMeta({ id: 'art_1', user: { displayName: 'Nova', avatarUrl: 'https://cdn.example/a.jpg' } }, BASE);
    expect(m.image).toBe('https://cdn.example/a.jpg');
  });
});

describe('duration + genre helpers', () => {
  it('formats ISO 8601 and human durations', () => {
    expect(isoDuration(118)).toBe('PT1M58S');
    expect(humanDuration(118)).toBe('1:58');
    expect(humanDuration(5)).toBe('0:05');
  });
  it('humanizes genre labels', () => {
    expect(genreLabel('lo-fi_house')).toBe('Lo Fi House');
    expect(genreLabel(null)).toBeNull();
  });

  it('prefers the canonical taxonomy label for known genre keys/aliases (never a naive humanization)', () => {
    // Correct punctuation/casing that naive title-casing would get wrong.
    expect(genreLabel('hip_hop')).toBe('Hip-Hop');
    expect(genreLabel('rnb')).toBe('R&B');
    expect(genreLabel('lofi')).toBe('Lo-fi');
    expect(genreLabel('other')).toBe('Other');
    // Legacy/alias values still normalize to the canonical label.
    expect(genreLabel('Hip Hop')).toBe('Hip-Hop');
    expect(genreLabel('Dark Synth')).toBe('Synthwave');
  });

  it('never returns a localized genre label (backend has no locale/request-language handling)', () => {
    // The backend is English-only end to end; this is a regression guard, not
    // a locale switch (there is nothing to switch — see
    // NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md).
    expect(genreLabel('hip_hop')).not.toMatch(/[Ѐ-ӿ]/); // no Cyrillic
  });
});
