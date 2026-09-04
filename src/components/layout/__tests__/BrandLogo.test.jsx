import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BrandLogo from '../BrandLogo';
import { usePlayerStore } from '../../../store/playerStore';

const demoTrack = {
  id: 'brand-test-track',
  title: 'Brand test track',
  artistName: 'NoirSound',
};

function renderBrandLogo() {
  return render(
    <MemoryRouter>
      <BrandLogo />
    </MemoryRouter>
  );
}

afterEach(() => {
  usePlayerStore.setState({ currentTrack: null, isPlaying: false });
});

describe('BrandLogo', () => {
  it('links to Home with an accessible label', () => {
    renderBrandLogo();
    expect(screen.getByRole('link', { name: 'NoirSound home' })).toHaveAttribute('href', '/');
  });

  it('announces playing and paused states from the player store', () => {
    usePlayerStore.setState({ currentTrack: demoTrack, isPlaying: true });
    const { rerender } = renderBrandLogo();

    expect(screen.getByText('Music playing')).toBeInTheDocument();

    usePlayerStore.setState({ isPlaying: false });
    rerender(
      <MemoryRouter>
        <BrandLogo />
      </MemoryRouter>
    );

    expect(screen.getByText('Music paused')).toBeInTheDocument();
  });
});
