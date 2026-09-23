import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import Header from '../../src/components/layout/Header';
import Footer from '../../src/components/layout/Footer';
import LibraryDrawer from '../../src/components/layout/LibraryDrawer';
import { useUserStore } from '../../src/store/userStore';

describe('Language selection is restricted to settings', () => {
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

  it('keeps the header localized without a language control', async () => {
    await i18n.changeLanguage('uk');
    render(<MemoryRouter><Header /></MemoryRouter>);
    expect(screen.queryByTestId('language-switcher-compact')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('header.signIn') })).toBeInTheDocument();
  });

  it('does not render a language control in Footer', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('language-switcher-compact')).not.toBeInTheDocument();
  });

  it('does not render a language control in LibraryDrawer', () => {
    render(
      <MemoryRouter>
        <LibraryDrawer isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('language-switcher-compact')).not.toBeInTheDocument();
  });
});
