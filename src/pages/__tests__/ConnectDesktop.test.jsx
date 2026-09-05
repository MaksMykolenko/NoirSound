import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConnectDesktop from '../ConnectDesktop';
import * as desktopConnectApi from '../../api/desktopConnect';
import { useUserStore } from '../../store/userStore';

describe('ConnectDesktop Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useUserStore.setState({
      user: { id: 'user-123', username: 'tester', displayName: 'Tester' },
      authHydrated: true
    });
  });

  it('renders pairing input when no code in query params', () => {
    render(
      <MemoryRouter initialEntries={['/connect/desktop']}>
        <ConnectDesktop />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /NoirSound Connect/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. K7F4-M2QP/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Find Device/i })).toBeInTheDocument();
  });

  it('fetches device info automatically when code is present in query params', async () => {
    vi.spyOn(desktopConnectApi, 'getPairingVerifyInfo').mockResolvedValue({
      userCode: 'K7F4-M2QP',
      deviceName: 'MacBook Pro M3',
      platform: 'macOS',
      appVersion: '0.1.0'
    });

    render(
      <MemoryRouter initialEntries={['/connect/desktop?code=K7F4-M2QP']}>
        <ConnectDesktop />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('MacBook Pro M3')).toBeInTheDocument();
      expect(screen.getByText('macOS')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect/i })).toBeInTheDocument();
    });
  });

  it('authorizes device successfully when Connect button is clicked', async () => {
    vi.spyOn(desktopConnectApi, 'getPairingVerifyInfo').mockResolvedValue({
      userCode: 'K7F4-M2QP',
      deviceName: 'MacBook Air',
      platform: 'macOS',
      appVersion: '0.1.0'
    });
    const authorizeSpy = vi.spyOn(desktopConnectApi, 'authorizePairingDevice').mockResolvedValue({
      status: 'success'
    });

    render(
      <MemoryRouter initialEntries={['/connect/desktop?code=K7F4-M2QP']}>
        <ConnectDesktop />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connect/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Connect/i }));

    await waitFor(() => {
      expect(authorizeSpy).toHaveBeenCalledWith('K7F4-M2QP', true);
      expect(screen.getByText(/Device Connected!/i)).toBeInTheDocument();
    });
  });

  it('displays sign in required when user is not authenticated', () => {
    useUserStore.setState({ user: null, authHydrated: true });

    render(
      <MemoryRouter initialEntries={['/connect/desktop?code=K7F4-M2QP']}>
        <ConnectDesktop />
      </MemoryRouter>
    );

    expect(screen.getByText(/Sign in to connect device/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });
});
