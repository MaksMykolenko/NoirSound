import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Mail, Lock, User, AtSign, Loader2, Headphones, Sparkles, Link as LinkIcon } from 'lucide-react';
import { useLogin, useRegister } from '../../hooks/mutations/useAuth';
import { getGoogleAuthorizationUrl } from '../../api/client';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';
import { useLandingDraftStore } from '../../store/landingDraftStore';
import { useToastStore } from '../../store/toastStore';

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

export default function AuthModal({ isOpen, onClose, initialMode = 'login', initialAccountType = 'LISTENER' }) {
  const { t } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const [mode, setMode] = useState(initialMode);
  const [accountType, setAccountType] = useState(initialAccountType);
  const [creatorType, setCreatorType] = useState('ARTIST');
  const [intendsMusic, setIntendsMusic] = useState(true);
  const [intendsBeats, setIntendsBeats] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
    primaryPlatformUrl: '',
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
    setAccountType(initialAccountType || 'LISTENER');
    setErrorMsg('');
  }, [initialMode, initialAccountType, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrorMsg('');
  };

  const handleCreatorTypeChange = (type) => {
    setCreatorType(type);
    if (type === 'ARTIST') {
      setIntendsMusic(true);
      setIntendsBeats(false);
    } else if (type === 'BEATMAKER') {
      setIntendsMusic(false);
      setIntendsBeats(true);
    } else if (type === 'BOTH') {
      setIntendsMusic(true);
      setIntendsBeats(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (mode === 'login') {
        await loginMutation.mutateAsync({ email: formData.email, password: formData.password });
        addToast(t('auth.loginSuccess') || 'Welcome back!', 'success');
      } else {
        const isCreator = accountType === 'CREATOR';
        const payload = {
          email: formData.email.trim(),
          password: formData.password,
          username: formData.username.trim(),
          displayName: (formData.displayName || formData.username).trim(),
          accountType: isCreator ? 'CREATOR' : 'LISTENER',
        };

        if (isCreator) {
          payload.creatorType = creatorType;
          payload.intendsMusic = Boolean(intendsMusic);
          payload.intendsBeats = Boolean(intendsBeats);
          if (formData.primaryPlatformUrl && formData.primaryPlatformUrl.trim()) {
            payload.primaryPlatformUrl = formData.primaryPlatformUrl.trim();
            payload.portfolioUrl = formData.primaryPlatformUrl.trim();
          }
        }

        await registerMutation.mutateAsync(payload);
        if (isCreator) {
          addToast(
            t('auth.creatorSuccess') ||
              'Creator account registered! Your profile is ready. You will have upload access as soon as our creator phase opens.',
            'success'
          );
        } else {
          addToast(
            t('auth.listenerSuccess') || 'Account created! NoirSound public listening opens soon.',
            'success'
          );
        }
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const isRegister = mode === 'register';
  const isCreator = isRegister && accountType === 'CREATOR';

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
          <div className="mb-6 pr-8 text-left">
            <h2 id="auth-modal-title" className="mb-1 font-sans text-2xl font-bold tracking-tight text-[var(--ns-text)]">
              {mode === 'login'
                ? t('header.signIn')
                : isCreator
                ? t('auth.joinCreator') || 'Register as Creator'
                : t('auth.join') || 'Join NoirSound'}
            </h2>
            <p className="text-sm text-zinc-400">
              {mode === 'login'
                ? t('empty.signInDesc')
                : isCreator
                ? t('auth.creatorDescription') || 'Claim your artist handle, establish your profile, and be first in line to publish.'
                : t('auth.registerDescription') || 'Create your account to start streaming and discovering independent sound.'}
            </p>
          </div>

          {/* Account Type Selector for Registration */}
          {isRegister && (
            <div className="mb-5 flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-1" role="tablist" aria-label="Account Type">
              <button
                type="button"
                role="tab"
                aria-selected={accountType === 'LISTENER'}
                onClick={() => setAccountType('LISTENER')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  accountType === 'LISTENER'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Headphones size={14} />
                <span>{t('auth.listenerTab') || 'Listener'}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={accountType === 'CREATOR'}
                onClick={() => setAccountType('CREATOR')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  accountType === 'CREATOR'
                    ? 'bg-brand-red text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles size={14} />
                <span>{t('auth.creatorTab') || 'Creator'}</span>
              </button>
            </div>
          )}

          {/* Creator Options */}
          {isCreator && (
            <div className="mb-5 space-y-3.5 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  {t('auth.creatorTypeLabel') || 'I identify as:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    ['ARTIST', t('auth.creatorTypes.ARTIST') || 'Artist'],
                    ['BEATMAKER', t('auth.creatorTypes.BEATMAKER') || 'Beatmaker'],
                    ['BOTH', t('auth.creatorTypes.BOTH') || 'Both'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleCreatorTypeChange(val)}
                      className={`py-1.5 px-2 rounded text-center font-medium transition-colors cursor-pointer ${
                        creatorType === val
                          ? 'bg-brand-red/20 text-brand-red border border-brand-red/50'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  {t('auth.intendsLabel') || 'What will you publish?'}
                </label>
                <div className="flex gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={intendsMusic}
                      onChange={(e) => setIntendsMusic(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-brand-red focus:ring-0"
                    />
                    <span>{t('auth.intendsMusic') || 'Music / Songs'}</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={intendsBeats}
                      onChange={(e) => setIntendsBeats(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-brand-red focus:ring-0"
                    />
                    <span>{t('auth.intendsBeats') || 'Beats / Instrumentals'}</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Google SSO Button (shown when not registering as creator) */}
          {!isCreator && (
            <>
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
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
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
                    placeholder={isCreator ? (t('auth.artistNamePlaceholder') || 'Artist / Stage Name') : t('auth.displaynamePlaceholder')}
                    value={formData.displayName}
                    onChange={handleChange}
                    className="ns-field w-full pl-10 pr-4"
                    disabled={isLoading}
                    aria-describedby={errorMsg ? 'auth-error' : undefined}
                  />
                </div>

                {isCreator && (
                  <div className="relative">
                    <label htmlFor="auth-platform-url" className="sr-only">Portfolio or Profile Link</label>
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input
                      id="auth-platform-url"
                      type="url"
                      name="primaryPlatformUrl"
                      placeholder={t('auth.portfolioUrlPlaceholder') || 'https://soundcloud.com/... (optional)'}
                      value={formData.primaryPlatformUrl}
                      onChange={handleChange}
                      className="ns-field w-full pl-10 pr-4"
                      disabled={isLoading}
                    />
                  </div>
                )}
              </>
            )}

            <div className="relative">
              <label htmlFor="auth-email" className="sr-only">{t('auth.email')}</label>
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                id="auth-email"
                ref={emailRef}
                autoFocus={!isCreator}
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
              <span>
                {mode === 'login'
                  ? t('header.signIn')
                  : isCreator
                  ? t('auth.registerAsCreator') || 'Register as Creator'
                  : t('actions.create') || 'Create Account'}
              </span>
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-500">
            {mode === 'login' ? (
              <p>
                {t('auth.noAccount')}{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-brand-red hover:text-[var(--ns-text-primary)] transition-colors font-medium cursor-pointer"
                >
                  {t('auth.signUp')}
                </button>
              </p>
            ) : (
              <p>
                {t('auth.haveAccount')}{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-brand-red hover:text-[var(--ns-text-primary)] transition-colors font-medium cursor-pointer"
                >
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
