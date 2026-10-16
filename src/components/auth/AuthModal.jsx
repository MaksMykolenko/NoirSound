import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Mail, Lock, Loader2 } from 'lucide-react';
import { useLogin, useRegister } from '../../hooks/mutations/useAuth';
import { onboardCreator } from '../../api/user';
import { getGoogleAuthorizationUrl } from '../../api/client';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';
import { useLandingDraftStore } from '../../store/landingDraftStore';
import { useToastStore } from '../../store/toastStore';
import { useUserStore } from '../../store/userStore';

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
  const currentUser = useUserStore((state) => state.user);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const [mode, setMode] = useState(initialMode);
  const [registrationStep, setRegistrationStep] = useState('email');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [isSubmittingOnboarding, setIsSubmittingOnboarding] = useState(false);
  const modalRef = useDialogFocusTrap(isOpen, onClose);
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const hasLandingDraft = useLandingDraftStore((state) => Boolean(state.draft));
  const isRegister = mode === 'register';
  const isExistingUserUpgrade = Boolean(currentUser && initialAccountType === 'CREATOR' && isRegister);
  const isEmailStep = isRegister && !isExistingUserUpgrade && registrationStep === 'email';
  const isPasswordStep = isRegister && !isExistingUserUpgrade && registrationStep === 'password';
  const isLoading = loginMutation.isPending || registerMutation.isPending || isSubmittingOnboarding;

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setRegistrationStep('email');
    setErrorMsg('');
    setFormData({ email: '', password: '' });
    setCreatorName(currentUser?.displayName === 'Listener' ? '' : currentUser?.displayName || '');
  }, [initialMode, isOpen, currentUser?.displayName]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isLoading) return;
    setErrorMsg('');
    if (isEmailStep) {
      if (!event.currentTarget.reportValidity()) return;
      setFormData((previous) => ({ ...previous, email: previous.email.trim() }));
      setRegistrationStep('password');
      return;
    }
    try {
      if (isExistingUserUpgrade) {
        setIsSubmittingOnboarding(true);
        await onboardCreator({ displayName: creatorName.trim(), creatorType: 'BOTH', intendsMusic: true, intendsBeats: true });
        await fetchCurrentUser();
        addToast(t('start.creatorRequestSent'), 'success');
      } else if (isRegister) {
        // Publishing setup is offered on /upload, once the account exists.
        await registerMutation.mutateAsync({ email: formData.email.trim(), password: formData.password });
        addToast(t('start.accountCreated'), 'success');
      } else {
        await loginMutation.mutateAsync({ email: formData.email.trim(), password: formData.password });
        addToast(t('auth.loginSuccess'), 'success');
      }
      onClose();
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsSubmittingOnboarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[var(--ns-z-dialog)] flex items-end justify-center bg-[var(--ns-overlay)] p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isLoading) onClose(); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" aria-describedby="auth-modal-description"
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-lg border border-[var(--ns-border)] bg-[var(--ns-card-solid)] shadow-[var(--ns-shadow-modal)] mobile-safe-bottom sm:rounded-lg">
        <button type="button" onClick={onClose} disabled={isLoading} className="ns-icon-button absolute right-4 top-4 cursor-pointer" aria-label={t('auth.closeDialog')}><X size={16} /></button>
        <div className="p-6 sm:p-8">
          <div className="mb-6 pr-8">
            <h2 id="auth-modal-title" className="mb-2 text-2xl font-bold tracking-tight text-[var(--ns-text)]">
              {isExistingUserUpgrade ? t('start.requestAccess') : isPasswordStep ? t('start.createPassword') : isRegister ? t('auth.join') : t('header.signIn')}
            </h2>
            <p id="auth-modal-description" className="text-sm leading-relaxed text-[var(--ns-text-secondary)]">
              {isExistingUserUpgrade ? t('start.creatorAccessDescription') : isPasswordStep ? t('start.passwordStepDescription') : isRegister ? t('start.emailStepDescription') : t('start.loginDescription')}
            </p>
          </div>
          {!isExistingUserUpgrade && !isPasswordStep && <>
            <button type="button" disabled={isLoading} onClick={() => window.location.assign(getGoogleAuthorizationUrl())}
              aria-describedby={hasLandingDraft ? 'auth-landing-draft-notice' : undefined}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-[var(--ns-border)] bg-[var(--ns-input-bg)] px-3 font-medium text-[var(--ns-text)] hover:border-[var(--ns-text-secondary)] disabled:opacity-50">
              <GoogleIcon /> {t('auth.continueGoogle')}
            </button>
            {hasLandingDraft && <p id="auth-landing-draft-notice" className="mt-3 text-sm text-[var(--ns-text-secondary)]">{t('landing.creator.googleDraftNotice')}</p>}
            <div className="my-5 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-[var(--ns-border)]" /><span className="text-xs text-[var(--ns-text-secondary)]">{t('auth.or')}</span><span className="h-px flex-1 bg-[var(--ns-border)]" /></div>
          </>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isExistingUserUpgrade && <label className="block space-y-2 text-sm text-[var(--ns-text)]">
              <span>{t('start.artistName')}</span>
              <input className="ns-field px-4" required maxLength={120} value={creatorName} disabled={isLoading} onChange={(event) => setCreatorName(event.target.value)} autoComplete="nickname" />
            </label>}
            {!isExistingUserUpgrade && <>
              {isPasswordStep && <div className="flex flex-wrap items-center justify-between gap-x-3 rounded-md bg-[var(--ns-input-bg)] px-3 py-2 text-sm">
                <span className="min-w-0 break-all text-[var(--ns-text)]">{formData.email}</span>
                <button type="button" disabled={isLoading}
                  onClick={() => { setRegistrationStep('email'); setErrorMsg(''); }}
                  className="min-h-11 shrink-0 cursor-pointer font-medium text-[var(--ns-accent)] hover:underline disabled:opacity-50">
                  {t('start.changeEmail')}
                </button>
              </div>}
              {[
                ...(!isPasswordStep ? [{ name: 'email', label: t('auth.email'), placeholder: t('auth.emailPlaceholder'), type: 'email', Icon: Mail }] : []),
                ...(!isEmailStep ? [{ name: 'password', label: t('auth.password'), placeholder: t('auth.password'), type: 'password', Icon: Lock }] : []),
              ].map(({ name, label, placeholder, type, Icon }) => <div key={name} className="space-y-1.5">
                <label htmlFor={`auth-${name}`} className="block text-sm font-medium text-[var(--ns-text)]">{label}</label>
                <div className="relative">
                  <Icon aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ns-text-secondary)]" size={16} />
                  <input id={`auth-${name}`} name={name} type={type} required autoFocus={name === 'email' || isPasswordStep}
                    autoComplete={name === 'email' ? 'email' : isRegister ? 'new-password' : 'current-password'}
                    minLength={name === 'password' && isRegister ? 8 : undefined}
                    maxLength={name === 'password' && isRegister ? 128 : name === 'email' ? 254 : undefined}
                    placeholder={placeholder} value={formData[name]} disabled={isLoading}
                    onChange={(event) => { setFormData((prev) => ({ ...prev, [name]: event.target.value })); setErrorMsg(''); }}
                    className="ns-field w-full pl-10 pr-4 text-base sm:text-sm" aria-invalid={Boolean(errorMsg)}
                    aria-describedby={[errorMsg && 'auth-error', name === 'password' && isRegister && 'auth-password-help'].filter(Boolean).join(' ') || undefined} />
                </div>
                {name === 'password' && isRegister && <p id="auth-password-help" className="text-sm text-[var(--ns-text-secondary)]">{t('start.passwordHelp')}</p>}
              </div>)}
              {isEmailStep && <p className="text-sm leading-relaxed text-[var(--ns-text-secondary)]">{t('start.passwordNext')}</p>}
            </>}
            {errorMsg && <div id="auth-error" className="rounded-md border ns-status-badge ns-status-danger p-3 text-sm" role="alert">{errorMsg}</div>}
            <button type="submit" disabled={isLoading} className="ns-button-primary flex w-full cursor-pointer items-center justify-center gap-2 px-5 disabled:opacity-50">
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {isExistingUserUpgrade ? t('start.requestAccess') : isEmailStep ? t('start.continue') : isRegister ? t('auth.createAccount') : t('header.signIn')}
            </button>
          </form>
          {!isExistingUserUpgrade && <div className="mt-5 text-center text-sm text-[var(--ns-text-secondary)]">
            {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
            <button type="button" disabled={isLoading} onClick={() => { setMode(isRegister ? 'login' : 'register'); setRegistrationStep('email'); setErrorMsg(''); }} className="min-h-11 cursor-pointer font-semibold text-[var(--ns-accent)] hover:underline">
              {isRegister ? t('header.signIn') : t('auth.signUp')}
            </button>
          </div>}
        </div>
      </div>
    </div>
  );
}
