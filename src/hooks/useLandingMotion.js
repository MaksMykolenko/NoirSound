import { useEffect, useState } from 'react';

const MOTION_KEY = 'noirsound-landing-motion';
const clamp = (value) => Math.min(1, Math.max(0, value));
function readMotion() {
  try { return localStorage.getItem(MOTION_KEY) !== 'off'; } catch { return true; }
}

// React owns preference changes; scroll frames touch only this page's elements.
export default function useLandingMotion(rootRef) {
  const [preferred, setPreferred] = useState(readMotion);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [failed, setFailed] = useState(false);
  const enabled = preferred && !reduced && !failed;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const change = () => setReduced(media.matches);
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    let observer;
    let resizeObserver;
    let stopped = false;
    const $ = (selector) => root.querySelector(selector);
    const all = (selector) => [...root.querySelectorAll(selector)];
    const reset = () => {
      root.classList.remove('motion-ready');
      for (const el of all('[data-reveal]')) el.classList.add('is-visible');
      for (const el of all('.manifesto > span')) el.style.removeProperty('opacity');
      for (const selector of ['.hero', '#listen', '#create', '.interlude-text']) $(selector)?.removeAttribute('style');
    };
    const paint = () => {
      frame = 0;
      if (stopped) return;
      try {
        const vh = window.innerHeight;
        const y = window.scrollY;
        const small = window.innerWidth <= 800;
        const progress = $('.page-progress span');
        if (progress) progress.style.transform = `scaleX(${clamp(y / Math.max(document.documentElement.scrollHeight - vh, 1))})`;
        $('.site-header')?.classList.toggle('scrolled', y > 25);
        if (!enabled || small) return;
        const hero = $('.hero');
        if (hero) hero.style.setProperty('--hero', clamp(y / Math.max(hero.offsetHeight, 1)));
        const statement = $('#statement')?.getBoundingClientRect();
        if (statement) {
          const p = clamp((vh * .91 - statement.top) / (vh * .65));
          all('.manifesto > span').forEach((word, index) => {
            word.style.opacity = (.17 + .83 * clamp((p - index * .115) * 5)).toFixed(3);
          });
        }
        for (const [id, variable] of [['listen', '--listen'], ['create', '--create']]) {
          const section = $(`#${id}`);
          if (!section) continue;
          const rect = section.getBoundingClientRect();
          const p = clamp(-rect.top / Math.max(rect.height - vh, 1));
          section.style.setProperty(variable, p.toFixed(4));
          if (id === 'create') all('.creator-steps li').forEach((step, index) => step.classList.toggle('active', index === Math.min(2, Math.floor(p * 3))));
        }
        const interlude = $('.interlude')?.getBoundingClientRect();
        if (interlude) $('.interlude-text').style.transform = `translate3d(${8 - clamp((vh - interlude.top) / (vh + interlude.height)) * 43}vw,0,0)`;
      } catch {
        // Progressive enhancement must never hide content if an observer or frame fails.
        stop();
        setFailed(true);
      }
    };
    const requestFrame = () => { if (!stopped && !frame) frame = requestAnimationFrame(paint); };
    const resize = () => { reset(); requestFrame(); };
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', requestFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pageshow', requestFrame);
      document.removeEventListener('visibilitychange', requestFrame);
      reset();
    };
    try {
      if (enabled && typeof IntersectionObserver === 'function') {
        observer = new IntersectionObserver(entries => entries.forEach(entry => {
          if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
        }), { threshold: .15 });
        all('[data-reveal]').forEach(el => observer.observe(el));
        root.classList.add('motion-ready');
      }
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(requestFrame);
        resizeObserver.observe(root);
      }
      window.addEventListener('scroll', requestFrame, { passive: true });
      window.addEventListener('resize', resize, { passive: true });
      window.addEventListener('pageshow', requestFrame);
      document.addEventListener('visibilitychange', requestFrame);
      requestFrame();
    } catch { stop(); setFailed(true); }
    return stop;
  }, [enabled, rootRef]);

  return { enabled, reduced, toggle: () => {
    if (reduced) return;
    setPreferred(value => {
      try { localStorage.setItem(MOTION_KEY, value ? 'off' : 'on'); } catch { /* Private browsing is supported. */ }
      return !value;
    });
  } };
}
