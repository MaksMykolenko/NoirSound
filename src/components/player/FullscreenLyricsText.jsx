import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../../utils/formatTime';

export default function FullscreenLyricsText({ lyrics, progress, onSeek, scrollRef }) {
  const { t } = useTranslation();
  const activeRef = useRef(null);
  const [following, setFollowing] = useState(true);
  const timedLines = useMemo(() => (
    lyrics.lyricsType === 'SYNCED' && Array.isArray(lyrics.lyricsSynced)
      ? lyrics.lyricsSynced.filter(line => Number.isFinite(line.time) && line.time >= 0 && typeof line.text === 'string')
      : []
  ), [lyrics]);
  const activeIndex = timedLines.findLastIndex(line => line.time <= progress);

  useEffect(() => {
    const region = scrollRef.current;
    const stage = region?.closest('.ns-immersive-stage');
    const pauseFollowing = () => setFollowing(false);
    const pauseOnScrollKey = (event) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) pauseFollowing();
    };
    stage?.addEventListener('wheel', pauseFollowing, { passive: true });
    stage?.addEventListener('touchstart', pauseFollowing, { passive: true });
    region?.addEventListener('keydown', pauseOnScrollKey);
    return () => {
      stage?.removeEventListener('wheel', pauseFollowing);
      stage?.removeEventListener('touchstart', pauseFollowing);
      region?.removeEventListener('keydown', pauseOnScrollKey);
    };
  }, [scrollRef]);

  useEffect(() => {
    if (!following || !activeRef.current || !scrollRef.current) return;
    const region = scrollRef.current;
    const container = region.scrollHeight > region.clientHeight ? region : region.closest('.ns-immersive-stage');
    if (!container || container.scrollHeight <= container.clientHeight) return;
    const top = activeRef.current.getBoundingClientRect().top - container.getBoundingClientRect().top
      + container.scrollTop - container.clientHeight * .4;
    container.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [activeIndex, following, scrollRef]);

  return (
    <div className="ns-immersive-lyrics-copy">
      {timedLines.length ? (
        <>
          {!following && (
            <button type="button" className="ns-immersive-follow" onClick={() => setFollowing(true)}>
              {t('lyrics.followPlayback')}
            </button>
          )}
          {timedLines.map((line, index) => (
            <button
              type="button"
              key={`${index}-${line.time}`}
              ref={index === activeIndex ? activeRef : null}
              className="ns-immersive-stanza ns-immersive-timed-line"
              aria-current={index === activeIndex ? 'true' : undefined}
              title={`${t('player.trackProgress')}: ${formatTime(line.time)}`}
              onClick={() => { onSeek(line.time); setFollowing(true); }}
            >
              {line.text}
            </button>
          ))}
        </>
      ) : (
        String(lyrics.lyricsText || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((stanza, index) => (
          <p key={index} className="ns-immersive-stanza">{stanza}</p>
        ))
      )}
      <p className="ns-immersive-credit">{t('lyrics.providedByArtist')}</p>
    </div>
  );
}
