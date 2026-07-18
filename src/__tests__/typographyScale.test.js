import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Guards the centralized semantic typography scale defined in `src/index.css`
// (the "readability pass" tokens). These are plain text/regex assertions
// against the source CSS rather than rendered computed-style checks, because
// jsdom does not perform real layout/font-metric computation -- asserting on
// `getComputedStyle(...).fontSize` in a component test would be brittle and
// would not reliably catch a regression here anyway. Reading the source is
// the correct level for "did someone rename/remove/shrink a shared token".
const cssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../index.css'
);
const css = readFileSync(cssPath, 'utf-8');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');

function source(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf-8');
}

function blockBody(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  const openingBrace = text.indexOf('{', markerIndex + marker.length);
  if (openingBrace < 0) return null;

  let depth = 0;
  for (let index = openingBrace; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] !== '}') continue;
    depth -= 1;
    if (depth === 0) return text.slice(openingBrace + 1, index);
  }
  return null;
}

function productionSource(relativeDirectory = 'src') {
  const directory = path.join(projectRoot, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      return entry.isDirectory() ? productionSource(relativePath) : [source(relativePath)];
    })
    .join('\n');
}

function rootTokenValuePx(name) {
  const match = css.match(new RegExp(`--ns-${name}:\\s*([^;]+);`));
  if (!match) return null;
  const raw = match[1].trim();
  if (raw.endsWith('rem')) return parseFloat(raw) * 16;
  if (raw.endsWith('px')) return parseFloat(raw);
  return raw; // clamp(...) or other non-literal expression
}

describe('centralized typography scale (src/index.css)', () => {
  it('defines every semantic size token the readability pass introduced', () => {
    const requiredTokens = [
      '--ns-text-page-title',
      '--ns-text-section-title',
      '--ns-text-card-title',
      '--ns-text-body',
      '--ns-text-body-small',
      '--ns-text-label',
      '--ns-text-meta',
      '--ns-text-micro',
      '--ns-line-body',
      '--ns-line-snug',
      '--ns-line-compact',
      '--ns-tracking-label',
    ];
    for (const token of requiredTokens) {
      expect(css, `expected src/index.css to define ${token}`).toContain(`${token}:`);
    }
  });

  it('exposes the semantic scale as Tailwind utilities (text-ns-*, tracking-ns-label)', () => {
    const requiredUtilityVars = [
      '--text-ns-micro',
      '--text-ns-meta',
      '--text-ns-label',
      '--text-ns-body-sm',
      '--text-ns-body',
      '--text-ns-card-title',
      '--text-ns-section-title',
      '--tracking-ns-label',
    ];
    for (const token of requiredUtilityVars) {
      expect(css, `expected @theme block to alias ${token}`).toContain(`${token}:`);
    }
  });

  it('keeps meaningful body-text tiers at or above their minimum readable size', () => {
    // Floors agreed for the readability pass: body >= 15px, compact body ==
    // 14px, secondary/label >= 13px, metadata >= 12px. Micro (11-12px) is
    // reserved for unimportant technical marks only, never asserted here as
    // "body text".
    expect(rootTokenValuePx('text-body')).toBeGreaterThanOrEqual(15);
    expect(rootTokenValuePx('text-body-small')).toBe(14);
    expect(rootTokenValuePx('text-label')).toBeGreaterThanOrEqual(13);
    expect(rootTokenValuePx('text-meta')).toBeGreaterThanOrEqual(12);
    expect(rootTokenValuePx('text-card-title')).toBeGreaterThanOrEqual(14);
  });

  it('never lets --ns-text-micro (technical-mark only tier) drift into body-text territory', () => {
    // Micro exists for unimportant technical marks (per the spec's explicit
    // 11-12px carve-out). If this ever grows to body size, it stops doing
    // its job as the deliberately-small tier and every "is this text too
    // small" review has to start over.
    const micro = rootTokenValuePx('text-micro');
    expect(micro).toBeGreaterThanOrEqual(11 - 0.01);
    expect(micro).toBeLessThan(13);
  });

  it('keeps the page title fluid (clamp) with a floor at/above the old fixed size, not a fixed shrink', () => {
    const raw = rootTokenValuePx('text-page-title');
    expect(typeof raw).toBe('string');
    expect(raw).toMatch(/^clamp\(/);
    // Floor must be expressed in rem and be >= 1.75rem (28px) per the
    // agreed desktop/mobile page-title range (26-40px).
    const floorMatch = raw.match(/clamp\(([\d.]+)rem/);
    expect(floorMatch).not.toBeNull();
    expect(parseFloat(floorMatch[1])).toBeGreaterThanOrEqual(1.75);
  });
});

describe('production font contract', () => {
  const previousDisplayFamily = ['Cormorant', 'Garamond'].join(' ');
  const retiredDisplayFamily = ['Bona', 'Nova'].join(' ');

  it('defines Commissioner for UI and Literata for music display titles', () => {
    expect(css).toContain('--ns-font-ui: "Commissioner", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;');
    expect(css).toContain('--ns-font-display: "Literata", Georgia, "Times New Roman", serif;');
    expect(css).toContain('--ns-font-technical: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;');
    expect(css).toMatch(/html, body[\s\S]*font-family:\s*var\(--ns-font-ui\)/);
    expect(css).toMatch(/\.ns-display-title\s*\{[\s\S]*?font-family:\s*var\(--ns-font-display\)/);
  });

  it('loads only the required production families and weights', () => {
    expect(html).toContain('family=Commissioner:wght@400;500;600;700');
    expect(html).toContain('display=swap');
    expect(html).not.toContain('family=Literata');
    expect(css).toMatch(/@font-face\s*\{[\s\S]*?font-family:\s*"Literata";[\s\S]*?font-weight:\s*600;[\s\S]*?font-display:\s*swap;[\s\S]*?format\("woff"\)/);
    expect(css).toMatch(/@font-face\s*\{[\s\S]*?font-family:\s*"Literata";[\s\S]*?font-weight:\s*700;[\s\S]*?font-display:\s*swap;[\s\S]*?format\("woff"\)/);
    expect(`${html}\n${css}`).not.toContain(previousDisplayFamily);
    expect(`${html}\n${css}`).not.toContain(retiredDisplayFamily);
    expect(`${html}\n${css}`).not.toMatch(/Inter|Space Grotesk|JetBrains Mono/);
  });

  it('removes the retired display family from all production source', () => {
    expect(`${html}\n${productionSource()}`).not.toContain(retiredDisplayFamily);
  });

  it('keeps utility page titles on Commissioner instead of applying serif globally', () => {
    expect(css).toMatch(/\.ns-page-title\s*\{[\s\S]*?font-family:\s*var\(--ns-font-ui\)/);
    const utilityPages = [
      'src/pages/Library.jsx',
      'src/pages/Discover.jsx',
      'src/pages/Upload.jsx',
      'src/pages/upload/BatchUploadPage.jsx',
      'src/pages/Dashboard.jsx',
      'src/pages/LegalPage.jsx',
      'src/components/admin/AdminUI.jsx',
    ];
    for (const file of utilityPages) {
      expect(source(file), `${file} must not opt into the music display face`).not.toContain('ns-display-title');
    }
  });

  it('keeps Home and creator CTA headings on Commissioner', () => {
    const homeHero = source('src/components/home/HomeHero.jsx');
    const creatorCallout = source('src/components/home/CreatorCallout.jsx');
    expect(homeHero).toContain('ns-home-hero-title');
    expect(creatorCallout).toContain('ns-home-creator-title');
    expect(homeHero).not.toContain('ns-display-title');
    expect(creatorCallout).not.toContain('ns-display-title');
    expect(css).toMatch(/\.ns-home-hero-title\s*\{[\s\S]*?font-family:\s*var\(--ns-font-ui\)/);
    expect(css).toMatch(/\.ns-home-creator-title\s*\{[\s\S]*?font-family:\s*var\(--ns-font-ui\)/);
  });

  it('uses the display class only for large music entity titles', () => {
    const displaySurfaces = [
      'src/pages/ArtistPage.jsx',
      'src/pages/PlaylistPage.jsx',
      'src/pages/TrackPage.jsx',
      'src/components/player/FullscreenLyricsPlayer.jsx',
    ];
    for (const file of displaySurfaces) {
      expect(source(file), `${file} should contain an explicit display title`).toContain('ns-display-title');
    }
  });

  it('reserves mono for the technical audit-log identifier, not ordinary metadata', () => {
    const ordinaryMetadataFiles = [
      'src/components/player/PlayerBarShared.jsx',
      'src/components/player/QueuePanel.jsx',
      'src/components/tracks/TrackListItem.jsx',
      'src/components/playlists/PlaylistTrackTable.jsx',
      'src/components/layout/BrandLogo.jsx',
      'src/pages/ArtistPage.jsx',
      'src/pages/TrackPage.jsx',
    ];
    for (const file of ordinaryMetadataFiles) {
      expect(source(file), `${file} must use Commissioner for visible metadata`).not.toContain('font-mono');
    }
    expect(source('src/pages/admin/AdminAuditLogs.jsx')).toMatch(/targetId[\s\S]*?font-mono|font-mono[\s\S]*?targetId/);
  });

  it('keeps localized entity titles in the DOM and wraps them without truncate classes', () => {
    const titlePatterns = [
      ['src/pages/ArtistPage.jsx', /<h1 className="ns-display-title ns-display-title--entity[^"]*">\s*\{artist\.name\}/],
      ['src/pages/PlaylistPage.jsx', /<h1 className="ns-display-title ns-display-title--entity[^"]*">\{playlist\.name\}/],
      ['src/pages/TrackPage.jsx', /<h1 className="ns-display-title ns-display-title--entity[^"]*">\s*\{track\.title\}/],
    ];
    for (const [file, pattern] of titlePatterns) {
      const fileSource = source(file);
      expect(fileSource).toMatch(pattern);
      expect(fileSource.match(pattern)?.[0]).not.toContain('truncate');
    }
    expect(css).toMatch(/\.ns-display-title\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  });

  it('keeps fullscreen display typography clear of the player in short landscape viewports', () => {
    const fullscreenSource = source('src/components/player/FullscreenLyricsPlayer.jsx');
    const shortLandscape = blockBody(
      css,
      '@media (orientation: landscape) and (max-height: 500px) and (max-width: 1023px)'
    );
    const compactTitleRule = blockBody(
      shortLandscape || '',
      '.ns-fullscreen-compact-title'
    );
    const scopedCompactTitleRule = blockBody(
      shortLandscape || '',
      '.ns-lyrics-fullscreen .ns-fullscreen-compact-title'
    );

    expect(fullscreenSource).toContain('ns-fullscreen-mobile-display');
    expect(fullscreenSource).toContain('ns-fullscreen-compact-title');
    expect(shortLandscape).toMatch(/\.ns-fullscreen-mobile-display\s*\{[^}]*display:\s*none/);
    expect(compactTitleRule).toMatch(/font-family:\s*var\(--ns-font-display\)/);
    expect(compactTitleRule).toMatch(/font-size:\s*1\.5rem/);
    expect(compactTitleRule).toMatch(/font-weight:\s*600/);
    expect(compactTitleRule).toMatch(/line-height:\s*1\.1/);
    expect(scopedCompactTitleRule).toMatch(/white-space:\s*normal/);
    expect(scopedCompactTitleRule).toMatch(/overflow-wrap:\s*anywhere/);
    expect(scopedCompactTitleRule).toMatch(/display:\s*-webkit-box/);
    expect(scopedCompactTitleRule).toMatch(/-webkit-box-orient:\s*vertical/);
    expect(scopedCompactTitleRule).toMatch(/-webkit-line-clamp:\s*2/);
    expect(scopedCompactTitleRule).toMatch(/overflow:\s*hidden/);
    expect(scopedCompactTitleRule).toMatch(/max-height:\s*3\.3rem/);
  });
});
