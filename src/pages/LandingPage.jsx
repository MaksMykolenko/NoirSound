import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigationType } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageMeta from '../components/meta/PageMeta';
import LandingHeader, { LandingBrand } from '../components/landing/LandingHeader';
import LandingListenSection from '../components/landing/LandingListenSection';
import LandingCreatorSection from '../components/landing/LandingCreatorSection';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';
import useLandingMotion from '../hooks/useLandingMotion';
import { useLandingDraftStore } from '../store/landingDraftStore';
import { usePlayerStore } from '../store/playerStore';
import '../components/landing/landing.css';

export default function LandingPage() {
  const { t } = useTranslation();
  const root = useRef(null);
  const motion = useLandingMotion(root);
  const playing = usePlayerStore(s => s.isPlaying);
  const location = useLocation();
  const navigationType = useNavigationType();
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
  const words = key => t(key).split(' ').map((word, index) => <React.Fragment key={`${key}-${index}`}><span>{word.endsWith('.') ? <>{word.slice(0, -1)}<span className="accent">.</span></> : word}</span>{' '}</React.Fragment>);
  return <div ref={root} className={`ns-landing${motion.enabled ? '' : ' no-motion'}${playing ? ' is-playing' : ''}`}>
    <PageMeta title={t('landing.metaTitle')} description={t('landing.metaDescription')} canonical="https://noirsound.co/" />
    <Link className="skip-link" to="/#landing-main">{t('landing.skip')}</Link>
    <div className="page-progress" aria-hidden="true"><span /></div>
    <LandingHeader motion={motion} />
    <main id="landing-main" tabIndex={-1}>
      <section className="hero" id="top" aria-labelledby="landing-hero-title">
        <div className="hero-content">
          <h1 id="landing-hero-title"><span className="hero-line">{t('landing.heroFirst')}</span><span className="hero-line">{t('landing.heroSecond')}<span className="accent">.</span></span></h1>
          <div className="hero-bottom"><p>{t('landing.heroCopy')}</p><div className="hero-buttons"><Link className="button button-light" to="/#listen">{t('landing.hear')}<ArrowRight className="icon" aria-hidden="true" /></Link><Link className="text-link" to="/#create">{t('landing.becomeCreator')}<ArrowUpRight className="icon" aria-hidden="true" /></Link></div></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="record-sleeve"><span className="sleeve-top">NOIR / SOUND<br />INDEPENDENT BY NATURE</span><span className="sleeve-letter">n.</span><span className="sleeve-bottom">SIDE A — OWN YOUR SOUND</span></div>
          <div className="record-wrap"><div className="record-vinyl"><div className="record-label"><span>NOIRSOUND</span><strong>NS</strong><div className="spindle" /><small>MUSIC &amp; BEATS<br />SIDE A / 001</small></div></div></div>
          <span className="hero-art-caption">{t('landing.artCaption')}</span>
        </div>
        <div className="hero-foot"><Link className="scroll-cue" to="/#statement"><span className="scroll-line" />{t('landing.scroll')}</Link></div>
      </section>
      <section className="statement" id="statement" aria-label={t('landing.statementLabel')}>
        <span className="eyebrow statement-label">{t('landing.statementLabel')}</span><p className="manifesto">{words('landing.statementFirst')}<br />{words('landing.statementSecond')}</p>
        <div className="statement-foot"><span>{t('landing.statementNote')}</span><span className="fine-index">↓ 01 / {t('landing.listen')}</span></div>
      </section>
      <LandingListenSection />
      <section className="interlude" aria-label={t('landing.interludeLabel')}><div className="interlude-text" aria-hidden="true">{t('landing.interludeListen')} <span>{t('landing.interludeCreate')}</span> {t('landing.interludeRepeat')}</div></section>
      <LandingCreatorSection />
      <section className="closing" aria-labelledby="landing-closing-title"><span className="eyebrow" data-reveal>{t('landing.closingLabel')}</span><h2 id="landing-closing-title" data-reveal>{t('landing.closingFirst')}<br />{t('landing.closingSecond')} <span className="closing-outline">{t('landing.closingTrack')}</span></h2><div className="closing-actions" data-reveal><Link className="button button-accent" to="/discover">{t('landing.listen')}<Play className="icon" aria-hidden="true" /></Link><Link className="text-link" to="/upload" onClick={() => useLandingDraftStore.getState().requestUpload()}>{t('landing.publish')}<ArrowUpRight className="icon" aria-hidden="true" /></Link></div><div className="closing-wordmark" aria-hidden="true">NoirSound.</div></section>
    </main>
    <footer className="site-footer"><LandingBrand /><span>{t('landing.footerNote')}</span><nav aria-label={t('landing.support')}><Link to="/terms">{t('landing.terms')}</Link><Link to="/privacy">{t('landing.privacy')}</Link><Link to="/abuse">{t('landing.support')}</Link></nav><LanguageSwitcher variant="select" className="landing-language" /><span className="footer-note">© {new Date().getFullYear()} NoirSound</span></footer>
  </div>;
}
