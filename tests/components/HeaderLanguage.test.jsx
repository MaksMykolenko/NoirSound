import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import Header from '../../src/components/layout/Header';
import Footer from '../../src/components/layout/Footer';
import LibraryDrawer from '../../src/components/layout/LibraryDrawer';
import { useUserStore } from '../../src/store/userStore';

describe('Global Language Switching', () => {
  const originalUserState = useUserStore.getState();

  beforeEach(async () => {
    localStorage.removeItem('noirsound_language');
    await i18n.changeLanguage('en');
    useUserStore.setState({
      user: null,
      setAuthModalOpen: vi.fn(),
    });
  });

  afterEach(() => {
    useUserStore.setState(originalUserState, true);
  });

  it('renders compact language switcher in Header for guests and switches language', async () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const switcher = screen.getByTestId('language-switcher-compact');
    expect(switcher).toBeInTheDocument();

    const uaBtn = screen.getByRole('button', { name: 'Українська' });
    expect(uaBtn).toBeInTheDocument();

    fireEvent.click(uaBtn);

    await waitFor(() => {
      expect(i18n.language).toContain('uk');
      expect(localStorage.getItem('noirsound_language')).toBe('uk');
    });
  });

  it('renders language switcher in Footer', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByTestId('language-switcher-compact')).toBeInTheDocument();
  });

  it('renders language switcher in LibraryDrawer', () => {
    render(
      <MemoryRouter>
        <LibraryDrawer isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('language-switcher-compact')).toBeInTheDocument();
  });
});
