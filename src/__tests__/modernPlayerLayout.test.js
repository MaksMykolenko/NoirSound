import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function source(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('modern player layout contract', () => {
  const css = source('src/index.css');

  it('preserves the 96rem content boundary and defines semantic page variants', () => {
    expect(css).toContain('--ns-content-max-width: 96rem;');
    for (const variant of ['standard', 'wide', 'immersive', 'form', 'admin', 'reading']) {
      expect(css).toContain(`.ns-layout-page--${variant}`);
    }
    for (const primitive of ['.ns-page-header', '.ns-music-hero', '.ns-media-grid', '.ns-track-list']) {
      expect(css).toContain(primitive);
    }
  });

  it('accounts for device safe areas in the viewport, header, navigation, and player spacing', () => {
    expect(source('index.html')).toMatch(/viewport-fit=cover/);
    expect(css).toContain('--ns-safe-area-top: env(safe-area-inset-top, 0px);');
    expect(css).toContain('--ns-safe-area-bottom: env(safe-area-inset-bottom, 0px);');
    expect(css).toMatch(/--ns-mobile-nav-height:\s*calc\([^;]*--ns-safe-area-bottom/);

    const appLayout = source('src/components/layout/AppLayout.jsx');
    expect(appLayout).toContain('var(--ns-mobile-nav-height)');
    expect(appLayout).toContain('var(--ns-mobile-player-height)');
    expect(appLayout).toContain('var(--ns-player-height)');
  });

  it('uses genuine links for media navigation instead of nested interactive link roles', () => {
    const mediaFiles = [
      'src/components/tracks/TrackCard.jsx',
      'src/components/artists/ArtistCard.jsx',
      'src/components/playlists/PlaylistCard.jsx',
      'src/components/tracks/TrackListItem.jsx',
      'src/components/playlists/PlaylistTrackTable.jsx',
    ];
    for (const file of mediaFiles) {
      const fileSource = source(file);
      expect(fileSource, `${file} should use a real router link`).toMatch(/<Link\b/);
      expect(fileSource, `${file} must not emulate links with role=link`).not.toContain('role="link"');
    }
  });

  it('keeps Home music-first and places discovery and creator promotion after releases', () => {
    const home = source('src/pages/Home.jsx');
    const hero = home.indexOf('<HomeHero');
    const releases = home.indexOf('data-testid="home-releases"');
    const genres = home.indexOf('<BrowseByGenre');
    const creator = home.indexOf('<CreatorCallout');

    expect(hero).toBeGreaterThan(-1);
    expect(releases).toBeGreaterThan(hero);
    expect(genres).toBeGreaterThan(releases);
    expect(creator).toBeGreaterThan(genres);
    expect(home).not.toContain('<ProductFeatures');
  });

  it('keeps mobile discovery controls scrollable and the search input at 16px', () => {
    const discover = source('src/pages/Discover.jsx');
    expect(discover).toMatch(/type="search"[\s\S]*?text-base sm:text-sm/);
    expect(discover).toMatch(/data-testid="genre-quick-tabs"[\s\S]*?overflow-x-auto/);
  });

  it('limits narrow track rows to play and one context action without dropping menu access', () => {
    const trackListItem = source('src/components/tracks/TrackListItem.jsx');
    const playlistRows = source('src/components/playlists/PlaylistTrackTable.jsx');
    const queuePanel = source('src/components/player/QueuePanel.jsx');
    const mobilePlaylistRow = playlistRows.slice(
      playlistRows.indexOf('function MobileRow'),
      playlistRows.indexOf('export default function PlaylistTrackTable')
    );

    expect(trackListItem).toMatch(/onClick=\{handleLike\}[\s\S]*?!hidden[\s\S]*?md:!inline-flex/);
    expect(trackListItem).toMatch(/onClick=\{handleQueue\}[\s\S]*?!hidden[\s\S]*?md:!inline-flex/);
    expect(trackListItem).toMatch(/onClick=\{openFromButton\}[\s\S]*?aria-haspopup="menu"/);

    expect(mobilePlaylistRow).not.toContain('toggleLikeTrack');
    expect(mobilePlaylistRow).toContain('openFromButton');
    expect(mobilePlaylistRow).toContain('!min-h-10 !min-w-10');

    expect(queuePanel).toMatch(/onClick=\{\(\) => playTrack\(track\)\}[\s\S]*?opacity-100[\s\S]*?md:opacity-0[\s\S]*?Play \$\{track\.title\}/);
    expect(queuePanel).toMatch(/onClick=\{openFromButton\}[\s\S]*?aria-haspopup="menu"/);
  });
});
