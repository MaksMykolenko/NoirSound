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
const SHELL =
  '<!doctype html><html lang="en"><head>' +
  '<meta charset="UTF-8">' +
  '<title>Old Title</title>' +
  '<meta name="description" content="old">' +
  '<meta property="og:title" content="old og">' +
  '<link rel="canonical" href="https://old/">' +
  '<script type="application/ld+json">{"@type":"WebSite"}</script>' +
  '</head><body><div id="root"></div><script src="/assets/index-abc.js"></script></body></html>';

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
});
