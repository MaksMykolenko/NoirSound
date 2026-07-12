import React from 'react';
import { readFileSync } from 'node:fs';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach } from 'vitest';
import SidebarPlaylistItem from '../../src/components/playlists/SidebarPlaylistItem';
import SidebarArtistItem from '../../src/components/artists/SidebarArtistItem';
import EmptyState from '../../src/components/ui/EmptyState';
import ToastContainer from '../../src/components/ui/ToastContainer';
import { useToastStore } from '../../src/store/toastStore';

// Regression coverage for the sitewide typography readability pass. These
// tests intentionally check *class contracts* (which semantic token/utility
// a node uses) and DOM truncation behavior, never computed pixel sizes --
// jsdom has no real layout engine, so a computed-style assertion would not
// catch a real regression and would be brittle to unrelated value tweaks.

const LONG_PLAYLIST_NAME =
  'This Is An Absurdly Long Playlist Name That Should Never Force The Sidebar Wider Or Break The Row Layout';
const LONG_ARTIST_NAME =
  'An Extremely Long Artist Display Name For Overflow Testing Purposes';

afterEach(cleanup);

describe('Sidebar long-name truncation', () => {
  it('SidebarPlaylistItem: renders the full name in the DOM and truncates it visually, without shrinking below the label tier', () => {
    render(
      <SidebarPlaylistItem
        playlist={{
          id: 'pl-1',
          name: LONG_PLAYLIST_NAME,
          creator: 'Some Artist',
          trackCount: 12,
          createdByCurrentUser: false,
        }}
      />,
      { wrapper: MemoryRouter }
    );

    // Full text must still be present in the DOM (truncation is a CSS
    // ellipsis, not a JS string cut) so it's copy-able / accessible.
    const title = screen.getByText(LONG_PLAYLIST_NAME);
    expect(title).toHaveClass('truncate');
    // Regression guard: this element used to be a raw text-[12px] utility;
    // it must use the shared card-title-adjacent body-small token instead.
    expect(title).toHaveClass('text-ns-body-sm');
    expect(title.className).not.toMatch(/text-\[\d/);

    const metaLine = screen.getByText(/tracks$/);
    expect(metaLine).toHaveClass('truncate');
    expect(metaLine).toHaveClass('text-ns-label');
  });

  it('SidebarArtistItem: renders the full name in the DOM, truncates visually, and keeps the "Artist" role label readable', () => {
    render(
      <SidebarArtistItem artist={{ id: 'artist-9', name: LONG_ARTIST_NAME, avatarUrl: null }} />,
      { wrapper: MemoryRouter }
    );

    const title = screen.getByText(LONG_ARTIST_NAME);
    expect(title).toHaveClass('truncate');
    expect(title).toHaveClass('text-ns-body-sm');
    expect(title.className).not.toMatch(/text-\[\d/);

    // Important sidebar role metadata stays at the 13px label tier.
    const roleLabel = screen.getByText('Artist');
    expect(roleLabel).toHaveClass('text-ns-label');
    expect(roleLabel.className).not.toMatch(/text-\[\d/);
  });
});

describe('Minimum-text-size component contracts', () => {
  it('EmptyState primary/secondary actions never regress to text-xs (12px uppercase CTA)', () => {
    render(
      <EmptyState
        title="Nothing here yet"
        description="Come back later."
        actionText="Take action"
        onAction={() => {}}
      />
    );
    const action = screen.getByRole('button', { name: 'Take action' });
    expect(action).toHaveClass('text-sm');
    expect(action.className).not.toMatch(/\btext-xs\b/);
  });

  it('ToastContainer message text never regresses to text-xs', () => {
    useToastStore.setState({
      toasts: [{ id: 't1', type: 'success', message: 'Saved changes' }],
    });
    render(<ToastContainer />);
    const message = screen.getByText('Saved changes');
    expect(message).toHaveClass('text-sm');
    expect(message.className).not.toMatch(/\btext-xs\b/);
    useToastStore.setState({ toasts: [] });
  });
});

describe('Locale layout: tab/step navs keep their horizontal-scroll safety net', () => {
  // Translated tab and step labels can run noticeably longer than their
  // English source (e.g. batchUpload.editMetadata is ~2x longer in
  // Russian/Ukrainian). The agreed-safe pattern sitewide is to let these
  // strips scroll horizontally rather than truncate or wrap the nav -- so
  // this locks in the `overflow-x-auto` + non-wrapping track on every nav
  // whose labels grew when this pass increased their font size.
  const filesWithScrollableTabs = [
    '../../src/pages/Profile.jsx',
    '../../src/pages/Library.jsx',
    '../../src/pages/upload/BatchUploadPage.jsx',
  ];

  it.each(filesWithScrollableTabs)('%s keeps its tab/step strip horizontally scrollable', (relativePath) => {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf-8');
    expect(source).toContain('ns-tabs-scroll');
    expect(source).toContain('overflow-x-auto');
  });
});
