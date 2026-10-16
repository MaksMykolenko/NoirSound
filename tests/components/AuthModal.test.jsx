import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import i18n from '../../src/i18n';
import AuthModal from '../../src/components/auth/AuthModal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserStore } from '../../src/store/userStore';

const initialUser = useUserStore.getState();
const registerUser = vi.fn();
const renderModal = (props = {}) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
  <AuthModal isOpen onClose={vi.fn()} {...props} />
</QueryClientProvider>);

describe('simple account form', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    useUserStore.setState({ user: null, registerUser });
  });
  afterEach(() => useUserStore.setState(initialUser, true));

  it('renders nothing when closed', () => {
    expect(renderModal({ isOpen: false }).container.firstChild).toBeNull();
  });

  it('keeps visible labels and Google sign-in', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('auth.email'))).toBeRequired();
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  it.each(['LISTENER', 'CREATOR'])('starts with email only for the %s entry point', (initialAccountType) => {
    const { container } = renderModal({ initialMode: 'register', initialAccountType });
    expect(container.querySelectorAll('input')).toHaveLength(1);
    expect(screen.getByLabelText(i18n.t('auth.email'))).toBeRequired();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Username')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Display Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it.each(['', 'not-an-email'])('keeps an invalid email (%s) on the first step', async (email) => {
    const user = userEvent.setup();
    renderModal({ initialMode: 'register' });
    fireEvent.change(screen.getByLabelText(i18n.t('auth.email')), { target: { value: email } });
    await user.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    expect(screen.getByLabelText(i18n.t('auth.email'))).toBeInvalid();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it('advances with Enter, focuses the password and does not create an account yet', async () => {
    const user = userEvent.setup();
    renderModal({ initialMode: 'register' });
    await user.type(screen.getByLabelText(i18n.t('auth.email')), 'person@example.test{Enter}');
    expect(screen.getByRole('heading', { name: 'Create a password' })).toBeInTheDocument();
    expect(screen.getByText('person@example.test')).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('auth.email'))).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '8');
    expect(screen.getByLabelText('Password')).toHaveAttribute('maxlength', '128');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(registerUser).not.toHaveBeenCalled();
  });

  it('allows correcting the email without losing the password and submits the corrected address', async () => {
    const onClose = vi.fn();
    registerUser.mockResolvedValueOnce({ id: 'new-listener' });
    renderModal({ initialMode: 'register', onClose });
    fireEvent.change(screen.getByLabelText(i18n.t('auth.email')), { target: { value: 'typo@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Eight spaces ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change email' }));
    expect(screen.getByLabelText(i18n.t('auth.email'))).toHaveValue('typo@example.test');
    expect(screen.getByLabelText(i18n.t('auth.email'))).toHaveFocus();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(i18n.t('auth.email')), { target: { value: 'correct@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    expect(screen.getByLabelText('Password')).toHaveValue('Eight spaces ');
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(registerUser).toHaveBeenCalledExactlyOnceWith({ email: 'correct@example.test', password: 'Eight spaces ' });
  });

  it('switches modes without clearing an entered email', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(i18n.t('auth.email')), { target: { value: 'person@example.test' } });
    fireEvent.click(screen.getByText('Sign up'));
    expect(screen.getByRole('heading', { name: 'Join NoirSound' })).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('auth.email'))).toHaveValue('person@example.test');
  });

  it('preserves input after a rejected signup and retries only the minimal payload', async () => {
    const onClose = vi.fn();
    registerUser.mockRejectedValueOnce(new Error('Please try again')).mockResolvedValueOnce({ id: 'new-listener' });
    renderModal({ initialMode: 'register', onClose });
    fireEvent.change(screen.getByLabelText(i18n.t('auth.email')), { target: { value: 'person@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: ' eight spaces ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('person@example.test')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue(' eight spaces ');
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(registerUser).toHaveBeenLastCalledWith({ email: 'person@example.test', password: ' eight spaces ' });
  });
});
