import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Mail, Lock, User, AtSign, Loader2 } from 'lucide-react';
import { useLogin, useRegister } from '../../hooks/mutations/useAuth';
import { getGoogleAuthorizationUrl } from '../../api/client';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';
import { useLandingDraftStore } from '../../store/landingDraftStore';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614Z" />
      <path fill="#4285F4" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z" />
      <path fill="#34A853" d="M9 3.58c1.322 0 2.508.454 3.441 1.345l2.581-2.582C13.464.891 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: ''
  });
  const [errorMsg, setErrorMsg] = useState('');
  const modalRef = useDialogFocusTrap(isOpen, onClose);
  const emailRef = useRef(null);

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const isLoading = loginMutation.isPending || registerMutation.isPending;
  const hasLandingDraft = useLandingDraftStore((state) => Boolean(state.draft));

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setErrorMsg('');
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (mode === 'login') {
        await loginMutation.mutateAsync({ email: formData.email, password: formData.password });
      } else {
        await registerMutation.mutateAsync(formData);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[var(--ns-z-dialog)] flex items-end justify-center bg-[var(--ns-overlay)] p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] shadow-[var(--ns-shadow-modal)] mobile-safe-bottom sm:rounded-lg"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="ns-icon-button absolute right-4 top-4 cursor-pointer"
          aria-label={t('auth.closeDialog')}
        >
          <X size={16} />
        </button>

        <div className="p-6 sm:p-8">
          <div className="mb-7 pr-8 text-left">
            <h2 id="auth-modal-title" className="mb-2 font-sans text-2xl font-bold tracking-tight text-[var(--ns-text)]">
              {mode === 'login' ? t('header.signIn') : t('auth.join')}
            </h2>
            <p className="text-sm text-zinc-400">
              {mode === 'login' 
                ? t('empty.signInDesc') 
                : t('auth.registerDescription')}
            </p>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => window.location.assign(getGoogleAuthorizationUrl())}
            aria-describedby={hasLandingDraft ? 'auth-landing-draft-notice' : undefined}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-[var(--ns-border)] bg-zinc-900 font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            <GoogleIcon />
            <span>{t('auth.continueGoogle')}</span>
          </button>
          {hasLandingDraft && <p id="auth-landing-draft-notice" className="mt-3 text-sm leading-relaxed text-zinc-400">{t('landing.creator.googleDraftNotice')}</p>}

          <div className="flex items-center gap-3 my-5" aria-hidden="true">
            <span className="h-px flex-1 bg-zinc-800" />
            <span className="font-sans tabular-nums text-ns-meta uppercase text-zinc-500">{t('auth.or')}</span>
            <span className="h-px flex-1 bg-zinc-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="relative">
                  <label htmlFor="auth-username" className="sr-only">{t('auth.username')}</label>
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input
                    id="auth-username"
                    type="text"
                    name="username"
                    required
                    placeholder={t('auth.username')}
                    value={formData.username}
                    onChange={handleChange}
                    className="ns-field w-full pl-10 pr-4"
                    disabled={isLoading}
                    aria-describedby={errorMsg ? 'auth-error' : undefined}
                  />
                </div>
                <div className="relative">
                  <label htmlFor="auth-display-name" className="sr-only">{t('auth.displayname')}</label>
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input
                    id="auth-display-name"
                    type="text"
                    name="displayName"
                    required
                    placeholder={t('auth.displaynamePlaceholder')}
                    value={formData.displayName}
                    onChange={handleChange}
                    className="ns-field w-full pl-10 pr-4"
                    disabled={isLoading}
                    aria-describedby={errorMsg ? 'auth-error' : undefined}
                  />
                </div>
              </>
            )}

            <div className="relative">
              <label htmlFor="auth-email" className="sr-only">{t('auth.email')}</label>
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                id="auth-email"
                ref={emailRef}
                autoFocus
                type="email"
                name="email"
                required
                placeholder={t('auth.emailPlaceholder')}
                value={formData.email}
                onChange={handleChange}
                className="ns-field w-full pl-10 pr-4"
                disabled={isLoading}
                aria-invalid={Boolean(errorMsg)}
                aria-describedby={errorMsg ? 'auth-error' : undefined}
              />
            </div>

            <div className="relative">
              <label htmlFor="auth-password" className="sr-only">{t('auth.password')}</label>
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                id="auth-password"
                type="password"
                name="password"
                required
                placeholder={t('auth.password')}
                value={formData.password}
                onChange={handleChange}
                className="ns-field w-full pl-10 pr-4"
                disabled={isLoading}
                aria-invalid={Boolean(errorMsg)}
                aria-describedby={errorMsg ? 'auth-error' : undefined}
              />
            </div>

            {errorMsg && (
              <div id="auth-error" className="rounded-md border ns-status-badge ns-status-danger p-3 text-center text-sm" role="alert">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full ns-button-primary px-5 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              <span>{mode === 'login' ? t('header.signIn') : t('actions.create')}</span>
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-500">
            {mode === 'login' ? (
              <p>
                {t('auth.noAccount')}{' '}
                <button onClick={() => setMode('register')} className="text-brand-red hover:text-[var(--ns-text-primary)] transition-colors font-medium cursor-pointer">
                  {t('auth.signUp')}
                </button>
              </p>
            ) : (
              <p>
                {t('auth.haveAccount')}{' '}
                <button onClick={() => setMode('login')} className="text-brand-red hover:text-[var(--ns-text-primary)] transition-colors font-medium cursor-pointer">
                  {t('header.signIn')}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
