import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FallbackAvatar from '../../src/components/ui/FallbackAvatar';
import FallbackCover from '../../src/components/ui/FallbackCover';

describe('fallback image handling and deterministic metadata', () => {
  it('derives initials for missing artwork and falls back after an image error', () => {
    const view = render(<FallbackCover title="Signal Bloom" artistName="Mira Vale" />);
    expect(screen.getByRole('img')).not.toHaveAttribute('src');
    expect(screen.getByText('SB')).toBeInTheDocument();
    view.rerender(<FallbackCover src="/unavailable-cover.png" title="Signal Bloom" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).not.toHaveAttribute('src');
    expect(screen.getByText('SB')).toBeInTheDocument();
  });

  it('preserves supplied artwork and retries a new source after an image failure', () => {
    const view = render(<FallbackCover src="/broken.png" title="Dark recording" />);
    fireEvent.error(screen.getByRole('img'));
    view.rerender(<FallbackCover src="/black-artwork.png" title="Dark recording" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/black-artwork.png');
  });

  it('derives avatar initials from the artist name', () => {
    render(<FallbackAvatar name="Northline Archive" />);
    expect(screen.getByRole('img')).toHaveTextContent('NA');
  });
});
