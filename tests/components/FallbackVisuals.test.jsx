import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FallbackAvatar from '../../src/components/ui/FallbackAvatar';
import FallbackCover from '../../src/components/ui/FallbackCover';

describe('deterministic fallback visuals', () => {
  it('produces the same cover key for the same metadata', () => {
    const first = render(
      <FallbackCover title="Signal Bloom" artistName="Mira Vale" genre="Ambient" />
    );
    const firstKey = first.getByRole('img').getAttribute('data-visual-key');
    first.unmount();

    const second = render(
      <FallbackCover title="Signal Bloom" artistName="Mira Vale" genre="Ambient" />
    );
    expect(second.getByRole('img')).toHaveAttribute('data-visual-key', firstKey);
  });

  it('produces stable avatar initials and key', () => {
    const first = render(<FallbackAvatar name="Northline Archive" />);
    const firstAvatar = first.getByRole('img');
    const firstKey = firstAvatar.getAttribute('data-visual-key');
    expect(firstAvatar).toHaveTextContent('NA');
    first.unmount();

    const second = render(<FallbackAvatar name="Northline Archive" />);
    expect(second.getByRole('img')).toHaveAttribute('data-visual-key', firstKey);
  });
});
