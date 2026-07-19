import React from 'react';
import { render, screen } from '@testing-library/react';
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
    expect(firstAvatar).toHaveClass('bg-zinc-900');
    expect(firstAvatar).not.toHaveClass('bg-[var(--ns-card-soft)]');
    first.unmount();

    const second = render(<FallbackAvatar name="Northline Archive" />);
    expect(second.getByRole('img')).toHaveAttribute('data-visual-key', firstKey);
  });

  it('opts into semantic fallback colors without changing the shared default', () => {
    render(<FallbackAvatar name="Theme Listener" semanticFallback />);

    const avatar = screen.getByRole('img');
    expect(avatar).toHaveClass('bg-[var(--ns-card-soft)]');
    expect(avatar.querySelector('span')).toHaveClass('border-[var(--ns-border)]');
    expect(avatar).toHaveTextContent('TL');
    expect(avatar.querySelector('span:last-child')).toHaveClass('text-[var(--ns-text)]');
  });
});
