import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Play, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageMeta from '../components/meta/PageMeta';
import LandingHeader, { LandingBrand } from '../components/landing/LandingHeader';
import LandingListenSection from '../components/landing/LandingListenSection';
import LandingCreatorSection from '../components/landing/LandingCreatorSection';
import useLandingMotion from '../hooks/useLandingMotion';
import { usePlayerStore } from '../store/playerStore';
import { useUserStore } from '../store/userStore';
import '../components/landing/landing.css';

export default function LandingPage() {
  const { t } = useTranslation();
  const root = useRef(null);
  const motion = useLandingMotion(root);
  const playing = usePlayerStore(s => s.isPlaying);
  const user = useUserStore(s => s.user);
  const openAuth = useUserStore(s => s.setAuthModalOpen);
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();
  const notice = searchParams.get('notice');

  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN');
  const isCreator = Boolean(user?.creatorRegistration);
  const publicAppEnabled = import.meta.env.VITE_PUBLIC_APP_ENABLED !== 'false';

  const motionEnabled = useRef(motion.enabled);
  useEffect(() => { motionEnabled.current = motion.enabled; }, [motion.enabled]);

  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id) {
      if (navigationType !== 'POP') window.scrollTo(0, 0);
      return;
    }
    const target = [...root.current.querySelectorAll('[id]')].find(el => el.id === id);
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: motionEnabled.current && navigationType !== 'POP' ? 'smooth' : 'auto', block: 'start' });
      if (id === 'landing-main') target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash, navigationType]);


  const dismissNotice = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('notice');
    setSearchParams(next, { replace: true });
  };

  return (
    <div ref={root} className={`ns-landing${motion.enabled ? '' : ' no-motion'}${playing ? ' is-playing' : ''}`}>
      <PageMeta title={t('landing.metaTitle')} description={t('landing.metaDescription')} canonical="https://noirsound.co/" />
      <Link className="skip-link" to="/#landing-main">{t('landing.skip')}</Link>
      <div className="page-progress" aria-hidden="true"><span /></div>

      {notice === 'coming-soon' && (
        <aside className="landing-notice-banner" role="status" aria-label="Platform Status Notice">
          <div className="landing-notice-content">
            <span className="landing-notice-badge">Coming Soon</span>
            <p className="landing-notice-text">
              {t('landing.noticeComingSoon') ||
                'NoirSound is currently in landing-only access. Full platform features will open soon! Create your account or register as a creator to be first in line.'}
            </p>
          </div>
          <button
            type="button"
            className="landing-notice-close"
            onClick={dismissNotice}
            aria-label="Dismiss notice"
          >
            <X size={15} />
          </button>
        </aside>
      )}

      <LandingHeader motion={motion} />

      <main id="landing-main" tabIndex={-1}>
        <section className="hero" id="top" aria-labelledby="landing-hero-title">
          <div className="hero-content">
            <h1 id="landing-hero-title">
              <span className="hero-line">{t('landing.heroFirst')}</span>
              <span className="hero-line">{t('landing.heroSecond')}<span className="accent">.</span></span>
            </h1>

            <div className="hero-bottom">
              <p>{t('start.heroDescription')}</p>

              {user ? (
                <div className="hero-buttons">
                  {(isAdmin || publicAppEnabled) ? (
                    <Link to="/discover" className="button button-accent">
                      <Play size={16} />{t('landing.openPlatform')}
                    </Link>
                  ) : <p>{t('landing.listenerNotice')}</p>}
                  {isCreator && !user.canUploadTracks && <p>{t('start.creatorPending')}</p>}
                </div>
              ) : (
                <div className="hero-buttons">
                  {publicAppEnabled ? <Link className="button button-accent" to="/discover">
                    <Play className="icon" aria-hidden="true" />{t('start.listenFree')}
                  </Link> : <Link className="button button-accent" to="/#listen">
                    <Play className="icon" aria-hidden="true" />{t('landing.listen')}
                  </Link>}
                  <Link className="button button-light" to={publicAppEnabled ? '/upload' : '/#create'}>
                    {t('start.forCreators')}<ArrowUpRight className="icon" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="record-sleeve">
              <span className="sleeve-top">NOIR / SOUND<br />INDEPENDENT BY NATURE</span>
              <span className="sleeve-letter">n.</span>
              <span className="sleeve-bottom">SIDE A — OWN YOUR SOUND</span>
            </div>
            <div className="record-wrap">
              <div className="record-vinyl">
                <div className="record-label">
                  <span>NOIRSOUND</span>
                  <strong>NS</strong>
                  <div className="spindle" />
                  <small>MUSIC &amp; BEATS<br />SIDE A / 001</small>
                </div>
              </div>
            </div>
          </div>
          <div className="hero-foot">
            <Link className="scroll-cue" to="/#listen">
              <span className="scroll-line" />
              {t('landing.scroll')}
            </Link>
          </div>
        </section>

        <LandingListenSection />

        <LandingCreatorSection />

        <section className="closing" aria-labelledby="landing-closing-title">
          <span className="eyebrow" data-reveal>{t('landing.closingLabel')}</span>
          <h2 id="landing-closing-title" data-reveal>
            {t('landing.closingFirst')}<br />{t('landing.closingSecond')} <span className="closing-outline">{t('landing.closingTrack')}</span>
          </h2>
          <div className="closing-actions" data-reveal>
            {canAccessAppOrPreview(publicAppEnabled, isAdmin) ? (
              <Link className="button button-accent" to="/discover">
                {t('landing.listen')}<Play className="icon" aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                className="button button-accent cursor-pointer"
                onClick={() => openAuth(true, 'register', 'LISTENER')}
              >
                {t('auth.createAccount') || 'Create Account'}
                <ArrowRight className="icon" aria-hidden="true" />
              </button>
            )}
            <Link className="text-link" to={publicAppEnabled ? '/upload' : '/#create'}>
              {t('landing.publish')}<ArrowUpRight className="icon" aria-hidden="true" />
            </Link>
          </div>
          <div className="closing-wordmark" aria-hidden="true">NoirSound.</div>
        </section>
      </main>

      <footer className="site-footer">
        <LandingBrand />
        <span>{t('landing.footerNote')}</span>
        <nav aria-label={t('landing.support')}>
          <Link to="/terms">{t('landing.terms')}</Link>
          <Link to="/privacy">{t('landing.privacy')}</Link>
          <Link to="/abuse">{t('landing.support')}</Link>
        </nav>
        <span className="footer-note">© {new Date().getFullYear()} NoirSound</span>
      </footer>
    </div>
  );
}

function canAccessAppOrPreview(publicAppEnabled, isAdmin) {
  return publicAppEnabled || isAdmin;
}
