import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../src/i18n';
import AuthModal from '../../src/components/auth/AuthModal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x">X</span>,
  Mail: () => <span data-testid="icon-mail">Mail</span>,
  Lock: () => <span data-testid="icon-lock">Lock</span>,
  User: () => <span data-testid="icon-user">User</span>,
  Eye: () => <span data-testid="icon-eye">Eye</span>,
  EyeOff: () => <span data-testid="icon-eyeoff">EyeOff</span>,
  Music: () => <span data-testid="icon-music">Music</span>,
  Headphones: () => <span data-testid="icon-headphones">Headphones</span>,
  AtSign: () => <span data-testid="icon-atsign">AtSign</span>,
}));

const queryClient = new QueryClient();

const renderWithProvider = (ui) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('AuthModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithProvider(<AuthModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the login form by default when open', () => {
    renderWithProvider(<AuthModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Email Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('switches to register form when "Sign up" is clicked', () => {
    renderWithProvider(<AuthModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Sign up'));
    expect(screen.getByText('Join NoirSound')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Display Name')).toBeInTheDocument();
  });

  it('has native required attributes on email and password', () => {
    renderWithProvider(<AuthModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('Email Address')).toBeRequired();
    expect(screen.getByPlaceholderText('Password')).toBeRequired();
  });
});
