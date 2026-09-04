import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('renders language switcher select for both guest and authenticated users', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MobileHeader onOpenDrawer={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('language-switcher-select')).toBeInTheDocument();

    useUserStore.setState({
      user: { id: 'viewer-1', username: 'viewer' },
    });

    rerender(
      <MemoryRouter>
        <MobileHeader onOpenDrawer={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('language-switcher-select')).toBeInTheDocument();
  });

  it('shows a compact selected code while retaining complete native language options', async () => {
    render(<MemoryRouter><MobileHeader onOpenDrawer={vi.fn()} /></MemoryRouter>);
    const switcher = screen.getByTestId('language-switcher-select');
    const select = within(switcher).getByRole('combobox', { name: 'Language' });
    expect(within(switcher).getByText('EN', { exact: true })).toHaveAttribute('aria-hidden', 'true');
    for (const name of ['EN — English', 'UA — Українська', 'PL — Polski', 'RU — Русский']) {
      expect(within(select).getByRole('option', { name })).toBeInTheDocument();
    }
    fireEvent.change(select, { target: { value: 'uk' } });
    await waitFor(() => expect(select).toHaveValue('uk'));
    expect(within(switcher).getByText('UA', { exact: true })).toBeInTheDocument();
  });
});
