import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import PageMeta from '../PageMeta';

describe('PageMeta', () => {
  beforeEach(() => { document.head.innerHTML = ''; });
  afterEach(cleanup);

  it('updates document title, description, and canonical on render', () => {
    render(
      <PageMeta
        title="Track Title — Artist · NoirSound"
        description="A great track on NoirSound."
        canonical="https://noirsound.co/track/abc"
      />
    );
    expect(document.title).toBe('Track Title — Artist · NoirSound');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe('A great track on NoirSound.');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://noirsound.co/track/abc');
  });

  it('reuses (does not duplicate) the description + canonical elements across renders', () => {
    render(<PageMeta title="One" description="d1" canonical="https://noirsound.co/a" />);
    render(<PageMeta title="Two" description="d2" canonical="https://noirsound.co/b" />);
    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.title).toBe('Two');
  });

  it('updates social metadata and removes the previous route schema through root, Track, Artist, and Discover navigation', () => {
    document.head.innerHTML = '<script type="application/ld+json">{"@type":"WebSite","url":"https://noirsound.co"}</script><meta name="robots" content="noindex">';
    const { rerender } = render(<PageMeta title="NoirSound — your sound" description="Music and beats." canonical="https://noirsound.co/" />);
    expect(document.head.querySelector('script[type="application/ld+json"]')).not.toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    rerender(<PageMeta title="Release — Creator" description="A real release." canonical="https://noirsound.co/track/real-track" />);
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:type"]')?.content).toBe('music.song');
    expect(document.head.querySelector('meta[property="og:image"]')?.content).toBe('https://noirsound.co/api/public/covers/real-track');
    expect(document.head.querySelector('meta[name="twitter:title"]')?.content).toBe('Release — Creator');
    rerender(<PageMeta title="Creator" description="Artist bio." canonical="https://noirsound.co/artist/real-artist" image="https://cdn.example/creator.png" />);
    expect(document.head.querySelector('meta[property="og:type"]')?.content).toBe('profile');
    expect(document.head.querySelector('meta[property="og:image"]')?.content).toBe('https://cdn.example/creator.png');
    rerender(<PageMeta title="Discover" description="Find music." canonical="https://noirsound.co/discover" />);
    expect(document.head.querySelector('meta[property="og:type"]')?.content).toBe('website');
    expect(document.head.querySelector('meta[property="og:url"]')?.content).toBe('https://noirsound.co/discover');
    expect(document.head.querySelector('meta[property="og:image"]')?.content).toBe('https://noirsound.co/og/noirsound-cover.png');
    for (const selector of ['meta[property="og:title"]', 'meta[property="og:image"]', 'meta[name="twitter:title"]', 'meta[name="description"]', 'link[rel="canonical"]']) {
      expect(document.head.querySelectorAll(selector)).toHaveLength(1);
    }
  });

  it('uses an honest default for malformed artist artwork without breaking navigation', () => {
    render(<PageMeta title="Creator" canonical="https://noirsound.co/artist/creator" image="https://%/broken" />);
    expect(document.head.querySelector('meta[property="og:image"]')?.content).toBe('https://noirsound.co/og/default-artist.png');
    expect(document.title).toBe('Creator');
  });
});
