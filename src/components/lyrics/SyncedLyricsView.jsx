import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { activeLyricIndex } from './timedLyrics';

export default function SyncedLyricsView({ trackId, lines, progress, onSeek }) {
  const { t } = useTranslation();
  const root = useRef(null);
  const [following, setFollowing] = useState(true);
  const [offset, setOffset] = useState(() => {
    try { return Math.max(-5, Math.min(5, Number(localStorage.getItem('noirsound.lyricsOffset:' + trackId)) || 0)); } catch { return 0; }
  });
  const active = activeLyricIndex(lines, progress + offset);
  const changeOffset = delta => {
    const next = Math.max(-5, Math.min(5, Math.round((offset + delta) * 10) / 10));
    setOffset(next);
    try { localStorage.setItem('noirsound.lyricsOffset:' + trackId, String(next)); } catch { /* Optional preference. */ }
  };
  useEffect(() => {
    if (!following || active < 0) return;
    const element = root.current?.querySelector('[data-active="true"]');
    const scroll = root.current?.closest('[data-testid="fullscreen-lyrics-scroll"]');
    if (!element || !scroll?.scrollTo) return;
    const top = element.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - scroll.clientHeight * 0.35;
    scroll.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [active, following]);
  return <div ref={root} onWheel={() => setFollowing(false)} onTouchMove={() => setFollowing(false)}>
    <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
      <button type="button" className="ns-button-secondary min-h-11 px-3" aria-pressed={following} onClick={() => setFollowing(value => !value)}>{t('lyrics.follow')}</button>
      <span>{t('lyrics.timing')}</span>
      <button type="button" className="ns-button-secondary min-h-11 min-w-11" aria-label={t('lyrics.earlier')} onClick={() => changeOffset(-0.5)}>−</button>
      <output aria-label={t('lyrics.timing')}>{offset > 0 ? '+' : ''}{offset.toFixed(1)} s</output>
      <button type="button" className="ns-button-secondary min-h-11 min-w-11" aria-label={t('lyrics.later')} onClick={() => changeOffset(0.5)}>+</button>
    </div>
    <div className="space-y-3 pb-[25vh]" aria-label={t('lyrics.synced')}>
      {lines.map((line, index) => {
        const isActive = active >= 0 && line.time === lines[active].time;
        return <button key={index} type="button" data-active={isActive} aria-current={isActive ? 'true' : undefined}
          className={'block min-h-11 w-full rounded px-1 py-1 text-left font-sans text-[clamp(1.25rem,2.5vw,2.125rem)] font-semibold leading-relaxed transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-brand-red ' + (isActive ? 'text-brand-red' : 'text-zinc-400 hover:text-zinc-100')}
          onClick={() => { onSeek(Math.max(0, line.time - offset)); setFollowing(true); }}>{line.text}</button>;
      })}
    </div>
  </div>;
}
