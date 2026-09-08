import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../../store/userStore';
import LanguageSwitcher from '../ui/LanguageSwitcher';

export function LandingBrand() {
  return <Link className="brand" to="/#top" aria-label="NoirSound"><Activity className="icon brand-icon" aria-hidden="true" /><span>NoirSound<span className="brand-period">.</span></span></Link>;
}

export default function LandingHeader({ motion }) {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const openAuth = useUserStore((s) => s.setAuthModalOpen);
  const logoutUser = useUserStore((s) => s.logoutUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [motionFeedback, setMotionFeedback] = useState(0);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const userMenuRef = useRef(null);
  const userMenuTriggerRef = useRef(null);
  const titleId = useId();
  const dialogId = useId();
  const close = () => setMenuOpen(false);

  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN');
  const publicAppEnabled = import.meta.env.VITE_PUBLIC_APP_ENABLED !== 'false';
  const canAccessApp = publicAppEnabled || isAdmin;

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleOutsideClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        userMenuTriggerRef.current?.focus();
        return;
      }
      if (!userMenuRef.current?.contains(e.target)) return;
      const items = [...userMenuRef.current.querySelectorAll('[role="menuitem"]')];
      const current = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = (current + 1) % items.length;
        items[next]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = (current - 1 + items.length) % items.length;
        items[prev]?.focus();
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const el = dialog.current;
    const invoker = trigger.current;
    const overflow = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = 'hidden';
    el.querySelector('button')?.focus({ preventScroll: true });
    const media = window.matchMedia('(min-width: 801px)');
    const resize = () => { if (media.matches) setMenuOpen(false); };
    media.addEventListener('change', resize);
    return () => {
      media.removeEventListener('change', resize);
      el.close();
      document.body.style.overflow = overflow;
      if (invoker?.isConnected) invoker.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  const handleSignIn = () => {
    close();
    openAuth(true, 'login');
  };

  const handleMotionToggle = () => {
    if (motion.reduced) return;
    setMotionFeedback(value => value + 1);
    motion.toggle();
  };

  const handleCreateAccount = () => {
    close();
    openAuth(true, 'register', 'LISTENER');
  };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    close();
    await logoutUser();
  };

  const containFocus = (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll('button:not([disabled]), a[href], select')];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  };

  return (
    <>
      <header className="site-header">
        <LandingBrand />
        <nav className="desktop-nav" aria-label={t('landing.navigation')}>
          <Link to="/#listen">{t('landing.listen')}</Link>
          <Link to="/#create">{t('landing.create')}</Link>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="motion-toggle"
            onClick={handleMotionToggle}
            aria-pressed={motion.enabled}
            aria-disabled={motion.reduced}
            title={motion.reduced ? t('landing.reducedMotion') : undefined}
            aria-label={t(`landing.${motion.enabled ? 'disableMotion' : 'enableMotion'}`)}
          >
            <svg
              key={motionFeedback}
              className={`icon motion-toggle-icon${motionFeedback ? ' motion-toggle-icon--clicked' : ''}`}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path className="motion-toggle-arrow motion-toggle-arrow-left" d="m8 8-4 4 4 4M4 12h8" />
              <path className="motion-toggle-arrow motion-toggle-arrow-right" d="m16 8 4 4-4 4M12 12h8" />
            </svg>
            <span>{t(`landing.${motion.enabled ? 'motionOn' : 'motionOff'}`)}</span>
          </button>

          {!user && canAccessApp && (
            <Link className="header-cta" to="/discover">
              {t('landing.openApp')}
              <ArrowUpRight className="icon" aria-hidden="true" />
            </Link>
          )}

          {user ? (
            <div className="user-menu-container" ref={userMenuRef}>
              <button
                type="button"
                ref={userMenuTriggerRef}
                className="user-menu-trigger"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`@${user.username || user.displayName || 'user'}`}
              >
                <span className="user-menu-name">@{user.username || user.displayName || 'user'}</span>
                <ChevronDown
                  className="user-menu-chevron"
                  aria-hidden="true"
                />
              </button>

              {userMenuOpen && (
                <div
                  className="user-menu-dropdown"
                  role="menu"
                  aria-label={t('landing.account') || 'Account'}
                >
                  <div className="user-menu-header">
                    <span className="user-menu-handle">@{user.username || user.displayName || 'user'}</span>
                    {user.email && <span className="user-menu-email">{user.email}</span>}
                  </div>

                  <div className="user-menu-items">
                    {canAccessApp && (
                      <Link
                        to="/discover"
                        className="user-menu-item"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <span>{t('landing.openApp')}</span>
                        <ArrowUpRight className="icon" aria-hidden="true" />
                      </Link>
                    )}

                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="user-menu-item"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <span>{t('admin.admin') || 'Адміністрування'}</span>
                        <ArrowUpRight className="icon" aria-hidden="true" />
                      </Link>
                    )}

                    <div className="user-menu-divider" role="separator" />

                    <button
                      type="button"
                      className="user-menu-item user-menu-logout"
                      role="menuitem"
                      onClick={handleSignOut}
                    >
                      <span>
                        {t('header.signOut', { defaultValue: t('header.logout', { defaultValue: 'Sign out' }) })}
                      </span>
                      <LogOut className="icon" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" className="landing-sign-in" onClick={handleSignIn}>
                {t('landing.signIn')}
              </button>
              <button
                type="button"
                className="header-cta hidden sm:inline-flex cursor-pointer"
                onClick={handleCreateAccount}
              >
                {t('auth.createAccount') || 'Create Account'}
              </button>
            </div>
          )}

          <button
            type="button"
            className="mobile-menu-trigger icon-button"
            ref={trigger}
            onClick={() => setMenuOpen(true)}
            aria-label={t('landing.menuOpen')}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls={dialogId}
          >
            <Menu className="icon" aria-hidden="true" />
          </button>
        </div>
      </header>

      <dialog ref={dialog} id={dialogId} className="nav-dialog" aria-labelledby={titleId} onCancel={close} onClose={close} onKeyDown={containFocus}>
        <div className="nav-dialog-head">
          <span id={titleId}>NoirSound.</span>
          <button type="button" className="icon-button" onClick={close} aria-label={t('landing.menuClose')}>
            <X className="icon" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={t('landing.navigation')}>
          <Link to="/#listen" onClick={close}>{t('landing.listen')}<span>01</span></Link>
          <Link to="/#create" onClick={close}>{t('landing.create')}<span>02</span></Link>
          {canAccessApp && (
            <Link to="/discover" onClick={close}>{t('landing.openApp')}<ArrowUpRight className="icon" aria-hidden="true" /></Link>
          )}
          {isAdmin && (
            <Link to="/admin" onClick={close}>{t('admin.admin') || 'Admin'}<ArrowUpRight className="icon" aria-hidden="true" /></Link>
          )}
          {user ? (
            <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col gap-2">
              <span className="text-xs text-zinc-400">@{user.username}</span>
              <button type="button" className="landing-sign-in text-left text-brand-red" onClick={handleSignOut}>
                {t('header.signOut', { defaultValue: t('header.logout', { defaultValue: 'Sign out' }) })}
              </button>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col gap-3">
              <button type="button" className="landing-sign-in text-left text-zinc-100 py-2" onClick={handleSignIn}>
                {t('landing.signIn')}
              </button>
              <button type="button" className="header-cta text-center py-2" onClick={handleCreateAccount}>
                {t('auth.createAccount') || 'Create Account'}
              </button>
            </div>
          )}
        </nav>
        <LanguageSwitcher variant="select" className="landing-language" />
      </dialog>
    </>
  );
}
