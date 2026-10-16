import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import LandingPage from '../../src/pages/LandingPage';
import { useUserStore } from '../../src/store/userStore';
import i18n from '../../src/i18n';

vi.mock('../../src/components/landing/LandingListenSection', () => ({
  default: () => <div data-testid="listen-section" />,
}));
vi.mock('../../src/components/landing/LandingCreatorSection', () => ({
  default: () => <div data-testid="creator-section" />,
}));
vi.mock('../../src/hooks/useLandingMotion', () => ({
  default: () => ({ enabled: false, reduced: false, toggle: vi.fn() }),
}));

describe('LandingPage Hero Buttons', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useUserStore.setState({
      user: null,
      authHydrated: true,
      isAuthModalOpen: false,
      authModalMode: 'login',
      authModalInitialAccountType: 'LISTENER',
    });
  });

  it('css allows pointer-events on hero buttons inside .hero-content', () => {
    const cssPath = path.resolve(__dirname, '../../src/components/landing/landing.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    expect(cssContent).toMatch(/\.ns-landing \.hero-content button/);
  });

  it.each(['en', 'uk'])('offers guest listening before creator setup in %s', async (lng) => {
    await i18n.changeLanguage(lng);
    const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const hero = within(container.querySelector('.hero-buttons'));
    expect(hero.getByRole('link', { name: i18n.t('start.listenFree') })).toHaveAttribute('href', '/discover');
    expect(hero.getByRole('link', { name: i18n.t('start.forCreators') })).toHaveAttribute('href', '/upload');
    expect(hero.queryByRole('button', { name: i18n.t('auth.createAccount') })).not.toBeInTheDocument();
  });

  it('offers signed-in listeners a direct platform entry in Ukrainian', async () => {
    await i18n.changeLanguage('uk');
    useUserStore.setState({
      user: { id: 'u1', username: 'testuser', role: 'LISTENER', creatorRegistration: null },
      authHydrated: true,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('link', { name: i18n.t('landing.openPlatform') })).toHaveAttribute('href', '/discover');
    expect(screen.queryByText(i18n.t('start.listenerReady'))).not.toBeInTheDocument();

    // Open user menu to access signOut in header
    const userMenuBtn = screen.getByRole('button', { name: /@testuser/i });
    await userEvent.click(userMenuBtn);

    // Verify signOut in header is localized to "Вийти"
    expect(screen.queryByText('header.signOut')).toBeNull();
    const signOutBtn = screen.getByRole('menuitem', { name: /вийти/i });
    expect(signOutBtn).toBeDefined();

  });

  it('css contains dedicated spacing rules for creator-cta-box', () => {
    const cssPath = path.resolve(__dirname, '../../src/components/landing/landing.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    expect(cssContent).toMatch(/\.ns-landing \.creator-cta-box\s*\{[^}]*padding:\s*22px 24px/);
    expect(cssContent).toMatch(/\.ns-landing \.creator-cta-content\s*\{[^}]*gap:\s*14px/);
    expect(cssContent).toMatch(/\.ns-landing \.creator-cta-box \.button\s*\{[^}]*min-height:\s*40px/);
  });
});
