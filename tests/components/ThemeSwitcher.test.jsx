import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import ThemeSwitcher from '../../src/components/ui/ThemeSwitcher';
import Header from '../../src/components/layout/Header';
import MobileHeader from '../../src/components/layout/MobileHeader';
import Footer from '../../src/components/layout/Footer';
import LibraryDrawer from '../../src/components/layout/LibraryDrawer';
import { DEFAULT_THEME, THEME_IDS } from '../../src/theme/themes';
import { useThemeStore } from '../../src/store/themeStore';
import { useUserStore } from '../../src/store/userStore';

describe('ThemeSwitcher', () => {
  const originalUserState = useUserStore.getState();

  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
    useThemeStore.setState({
      selectedTheme: DEFAULT_THEME,
      resolvedTheme: DEFAULT_THEME,
    });
    document.documentElement.dataset.theme = DEFAULT_THEME;
    document.documentElement.dataset.themePreference = DEFAULT_THEME;
    useUserStore.setState({
      user: null,
      setAuthModalOpen: vi.fn(),
    });
  });

  afterEach(() => {
    useUserStore.setState(originalUserState, true);
  });

  it('renders dropdown variant and allows selecting a theme', async () => {
    render(<ThemeSwitcher />);

    const button = screen.getByTestId('theme-switcher-dropdown');
    expect(button).toBeInTheDocument();
    expect(screen.queryByTestId('theme-switcher-menu')).not.toBeInTheDocument();

    // Open dropdown
    fireEvent.click(button);
    const menu = screen.getByTestId('theme-switcher-menu');
    expect(menu).toBeInTheDocument();

    // Select Midnight Blue
    const midnightBlueOption = screen.getByRole('menuitem', { name: /Midnight Blue/i });
    expect(midnightBlueOption).toBeInTheDocument();
    fireEvent.click(midnightBlueOption);

    // Menu should close and theme should be updated
    expect(screen.queryByTestId('theme-switcher-menu')).not.toBeInTheDocument();
    expect(useThemeStore.getState().selectedTheme).toBe('midnight-blue');
    expect(document.documentElement.dataset.theme).toBe('midnight-blue');
  });

  it('closes dropdown on Escape key', () => {
    render(<ThemeSwitcher />);

    const button = screen.getByTestId('theme-switcher-dropdown');
    fireEvent.click(button);
    expect(screen.getByTestId('theme-switcher-menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('theme-switcher-menu')).not.toBeInTheDocument();
  });

  it('closes dropdown on click outside', () => {
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <ThemeSwitcher />
      </div>
    );

    const button = screen.getByTestId('theme-switcher-dropdown');
    fireEvent.click(button);
    expect(screen.getByTestId('theme-switcher-menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    expect(screen.queryByTestId('theme-switcher-menu')).not.toBeInTheDocument();
  });

  it('renders select variant and switches theme', async () => {
    render(<ThemeSwitcher variant="select" />);

    const select = screen.getByRole('combobox', { name: /Appearance/i });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue(DEFAULT_THEME);

    fireEvent.change(select, { target: { value: 'emerald-dark' } });

    expect(useThemeStore.getState().selectedTheme).toBe('emerald-dark');
    expect(document.documentElement.dataset.theme).toBe('emerald-dark');
  });

  it('does not duplicate theme controls in the header', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('theme-switcher-dropdown')).not.toBeInTheDocument();
  });

  it('does not duplicate theme controls in the mobile header', () => {
    render(
      <MemoryRouter>
        <MobileHeader onOpenDrawer={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('theme-switcher-select')).not.toBeInTheDocument();
  });

  it('does not duplicate theme controls in Footer or LibraryDrawer', () => {
    const { unmount } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('theme-switcher-dropdown')).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter>
        <LibraryDrawer isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('theme-switcher-dropdown')).not.toBeInTheDocument();
  });
});
