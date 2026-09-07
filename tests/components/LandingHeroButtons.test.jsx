import React from 'react';
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

  it('clicking "Create Account" opens register modal with LISTENER mode', async () => {
    const user = userEvent.setup();
    const setAuthModalOpen = vi.fn();
    useUserStore.setState({ setAuthModalOpen });

    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    const heroButtons = container.querySelector('.hero-buttons');
    expect(heroButtons).not.toBeNull();
    const createBtn = within(heroButtons).getByRole('button', { name: /create account/i });
    await user.click(createBtn);

    expect(setAuthModalOpen).toHaveBeenCalledWith(true, 'register', 'LISTENER');
  });

  it('clicking "Become a creator" opens register modal with CREATOR mode', async () => {
    const user = userEvent.setup();
    const setAuthModalOpen = vi.fn();
    useUserStore.setState({ setAuthModalOpen });

    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    const heroButtons = container.querySelector('.hero-buttons');
    expect(heroButtons).not.toBeNull();
    const creatorBtn = within(heroButtons).getByRole('button', { name: /become a creator/i });
    await user.click(creatorBtn);

    expect(setAuthModalOpen).toHaveBeenCalledWith(true, 'register', 'CREATOR');
  });

  it('clicking Ukrainian "Створити акаунт" and "Стати автором" works in uk locale', async () => {
    await i18n.changeLanguage('uk');
    const user = userEvent.setup();
    const setAuthModalOpen = vi.fn();
    useUserStore.setState({ setAuthModalOpen });

    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    const heroButtons = container.querySelector('.hero-buttons');
    expect(heroButtons).not.toBeNull();
    const createBtn = within(heroButtons).getByRole('button', { name: /створити акаунт/i });
    await user.click(createBtn);
    expect(setAuthModalOpen).toHaveBeenCalledWith(true, 'register', 'LISTENER');

    const creatorBtn = within(heroButtons).getByRole('button', { name: /стати автором/i });
    await user.click(creatorBtn);
    expect(setAuthModalOpen).toHaveBeenCalledWith(true, 'register', 'CREATOR');
  });

  it('renders localized listener notice and upgrade button when signed in as listener in Ukrainian', async () => {
    await i18n.changeLanguage('uk');
    useUserStore.setState({
      user: { id: 'u1', username: 'testuser', role: 'LISTENER', creatorRegistration: null },
      authHydrated: true,
    });

    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    // Verify localized listener notice is displayed, NOT the raw key
    expect(screen.queryByText('landing.listenerNotice')).toBeNull();
    expect(screen.getByText(/Ви зареєстровані як слухач/i)).toBeDefined();

    // Verify upgrade button is localized, NOT the raw key
    expect(screen.queryByText('landing.creator.upgradeButton')).toBeNull();
    const upgradeBtn = screen.getByRole('button', { name: /зареєструватися як креатор/i });
    expect(upgradeBtn).toBeDefined();

    // Verify signOut in header is localized to "Вийти"
    expect(screen.queryByText('header.signOut')).toBeNull();
    const signOutBtn = screen.getByRole('button', { name: /вийти/i });
    expect(signOutBtn).toBeDefined();

    // Verify css contains max-width constraint for landing-user-status
    const cssPath = path.resolve(__dirname, '../../src/components/landing/landing.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    expect(cssContent).toMatch(/\.ns-landing \.landing-user-status\s*\{[^}]*max-width:\s*440px/);
  });
});
