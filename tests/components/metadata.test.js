import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..', '..');
const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const document = new DOMParser().parseFromString(html, 'text/html');

describe('social preview metadata', () => {
  it('publishes complete absolute Open Graph and Twitter metadata', () => {
    const content = (selector) => document.querySelector(selector)?.getAttribute('content');
    expect(content('meta[name="description"]')).toBeTruthy();
    expect(document.querySelector('link[rel="canonical"]')?.href).toBe('https://noirsound.co/');
    expect(content('meta[property="og:title"]')).toBeTruthy();
    expect(content('meta[property="og:description"]')).toBeTruthy();
    expect(content('meta[property="og:url"]')).toBe('https://noirsound.co/');
    expect(content('meta[property="og:image"]')).toBe(
      'https://noirsound.co/og/noirsound-cover.png'
    );
    expect(content('meta[property="og:image:width"]')).toBe('1200');
    expect(content('meta[property="og:image:height"]')).toBe('630');
    expect(content('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(content('meta[name="twitter:image"]')).toBe(
      'https://noirsound.co/og/noirsound-cover.png'
    );
  });

  it('embeds WebSite JSON-LD structured data', () => {
    const ld = document.querySelector('script[type="application/ld+json"]')?.textContent;
    expect(ld).toBeTruthy();
    const parsed = JSON.parse(ld);
    expect(parsed['@type']).toBe('WebSite');
    expect(parsed.url).toBe('https://noirsound.co');
  });

  it('ships the public OG image assets (1200x630)', () => {
    const ogDir = path.join(projectRoot, 'public', 'og');
    for (const file of ['noirsound-cover.png', 'default-track.png', 'default-artist.png']) {
      const p = path.join(ogDir, file);
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.statSync(p).size).toBeGreaterThan(10_000);
    }
  });
});
