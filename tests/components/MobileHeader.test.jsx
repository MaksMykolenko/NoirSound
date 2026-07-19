import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import MobileHeader from '../../src/components/layout/MobileHeader';
import { useUserStore } from '../../src/store/userStore';

describe('MobileHeader', () => {
  const originalUserState = useUserStore.getState();

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useUserStore.setState({
      user: null,
      setAuthModalOpen: vi.fn(),
    });
  });

  afterEach(() => {
    useUserStore.setState(originalUserState, true);
  });

  it('keeps a localized Sign In action directly in the anonymous app header', () => {
    render(
      <MemoryRouter>
        <MobileHeader onOpenDrawer={vi.fn()} />
      </MemoryRouter>,
    );

    const signIn = screen.getByRole('button', { name: 'Sign In' });
    expect(signIn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open library drawer' })).toHaveClass(
      '!hidden',
      'min-[351px]:!inline-flex',
    );

    fireEvent.click(signIn);
    expect(useUserStore.getState().setAuthModalOpen).toHaveBeenCalledWith(true);
  });

  it('does not render the anonymous action for an authenticated user', () => {
    useUserStore.setState({
      user: { id: 'viewer-1', username: 'viewer' },
    });

    render(
      <MemoryRouter>
        <MobileHeader onOpenDrawer={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open library drawer' })).not.toHaveClass('!hidden');
  });

  it('renders the longer Polish Sign In label without replacing it with an icon', async () => {
    await i18n.changeLanguage('pl');

    render(
      <MemoryRouter>
        <MobileHeader onOpenDrawer={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Zaloguj się' })).toBeInTheDocument();
  });
});
