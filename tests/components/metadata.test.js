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
      'https://noirsound.co/images/noirsound-social-preview.jpg'
    );
    expect(content('meta[property="og:image:width"]')).toBe('1200');
    expect(content('meta[property="og:image:height"]')).toBe('630');
    expect(content('meta[name="twitter:card"]')).toBe('summary_large_image');
  });

  it('ships a non-empty social preview image', () => {
    const previewPath = path.join(
      projectRoot,
      'public',
      'images',
      'noirsound-social-preview.jpg'
    );
    expect(fs.existsSync(previewPath)).toBe(true);
    expect(fs.statSync(previewPath).size).toBeGreaterThan(100_000);
  });
});
