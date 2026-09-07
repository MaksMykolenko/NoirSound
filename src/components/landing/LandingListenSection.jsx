import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Pause, Play, AudioLines } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLandingShowcase } from '../../api/tracks';
import { isMockMode } from '../../api/mode';
import { usePlayerStore } from '../../store/playerStore';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import FallbackCover from '../ui/FallbackCover';

const duration = (value) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '—';
const metadata = track => [track.artistName, track.contentType === 'BEAT' ? [track.beatBpm && `${track.beatBpm} BPM`, track.beatKey].filter(Boolean).join(' · ') : track.genre].filter(Boolean).join(' · ');

function ShowcaseRow({ track, playing, onPlay, onSelect }) {
  const { t } = useTranslation();
  const contextMenu = useTrackContextMenu(track);
  return <button type="button" className={`track-row${playing ? ' active' : ''}`} data-testid="landing-track" data-track-id={track.id}
    onClick={onPlay} onMouseEnter={onSelect} onFocus={onSelect} {...contextMenu.contextMenuProps}
    aria-label={t(`landing.${playing ? 'pause' : 'play'}`, { title: track.title })}>
    <span className="row-play">{playing ? <Pause className="icon" aria-hidden="true" /> : <Play className="icon" aria-hidden="true" />}</span>
    <span className="row-text"><strong>{track.title}</strong><small>{metadata(track)}</small></span><span className="row-time">{duration(track.duration)}</span>
  </button>;
}

export default function LandingListenSection() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('MUSIC');
  const [selected, setSelected] = useState(null);
  const tabs = useRef([]);
  const id = useId();
  const currentId = usePlayerStore(s => s.currentTrack?.id);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const playTrack = usePlayerStore(s => s.playTrack);
  const togglePlay = usePlayerStore(s => s.togglePlay);
  const query = useQuery({ queryKey: ['landing-showcase'], queryFn: ({ signal }) => getLandingShowcase({ signal }), staleTime: 60000, retry: false });
  const tracks = query.data?.[mode] || [];
  const featured = tracks.find(track => track.id === selected) || tracks[0];
  const music = mode === 'MUSIC';
  const play = track => {
    if (track.id === currentId) togglePlay();
    else playTrack(track, tracks, { type: 'landing', title: 'NoirSound' });
  };
  const changeMode = value => { setMode(value); setSelected(null); };
  const keydown = (event, index) => {
    let next;
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) next = 1 - index;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    else return;
    event.preventDefault();
    changeMode(next === 0 ? 'MUSIC' : 'BEAT');
    tabs.current[next]?.focus();
  };
  return <section className="listen-scene" id="listen" aria-labelledby={`${id}-title`}>
    <div className="listen-sticky">
      <div className="scene-head"><span className="eyebrow">{t('landing.listenLabel')}</span><span className="scene-note">{t(isMockMode() ? 'landing.demo' : 'landing.listenNote')}</span></div>
      <div className="listen-grid">
        <div className="listen-copy">
          <div className="mode-tabs" role="tablist" aria-label={t('landing.typeLabel')}>
            {['MUSIC', 'BEAT'].map((value, index) => <button key={value} ref={el => { tabs.current[index] = el; }} type="button" id={`${id}-${value}`} role="tab" aria-controls={`${id}-panel`} aria-selected={mode === value} tabIndex={mode === value ? 0 : -1} onClick={() => changeMode(value)} onKeyDown={event => keydown(event, index)}>{t(`landing.${index ? 'beats' : 'music'}`)}<span aria-hidden="true">0{index + 1}</span></button>)}
          </div>
          <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${mode}`} tabIndex={0}>
            <h2 id={`${id}-title`}>{t(`landing.${music ? 'musicTitle' : 'beatTitle'}`)}<br /><span className="dim">{t(`landing.${music ? 'musicSubtitle' : 'beatSubtitle'}`)}</span></h2>
            <p className="section-copy">{t(`landing.${music ? 'musicCopy' : 'beatCopy'}`)}</p>
            <div className="track-rows" aria-busy={query.isPending}>
              {query.isPending || query.isError || tracks.length === 0 ? <p className="showcase-status" role="status">{t(`landing.${query.isPending ? 'loading' : query.isError ? 'error' : 'empty'}`)}</p>
                : tracks.map(track => <ShowcaseRow key={track.id} track={track} playing={isPlaying && currentId === track.id} onPlay={() => play(track)} onSelect={() => setSelected(track.id)} />)}
            </div>
            <Link className="underlined-link" to={`/discover?content=${mode}`}>{t(`landing.${music ? 'musicCatalog' : 'beatCatalog'}`)}<ArrowUpRight className="icon" aria-hidden="true" /></Link>
          </div>
        </div>
        <div className="art-deck">
          <div className="deck-back deck-back-2" aria-hidden="true"><span>INDEPENDENT<br />BY NATURE.</span><b>02</b></div>
          <div className="deck-back deck-back-1" aria-hidden="true"><span>FIND YOUR<br />FREQUENCY.</span><b>01</b></div>
          <div className="deck-front">
            <div className="art-image-wrap">
              {featured ? <FallbackCover src={featured.coverUrl} title={featured.title} artistName={featured.artistName} genre={featured.genre} className="feature-artwork" loading="lazy" /> : <img className="feature-artwork" src={`/landing/${music ? 'm1' : 'b1'}.svg`} width="640" height="640" alt={t('landing.decorative')} loading="lazy" />}
              {featured && <button type="button" className="art-play" onClick={() => play(featured)} aria-label={t(`landing.${isPlaying && currentId === featured.id ? 'pause' : 'play'}`, { title: featured.title })}>{isPlaying && currentId === featured.id ? <Pause className="icon" aria-hidden="true" /> : <Play className="icon" aria-hidden="true" />}</button>}
            </div>
            <div className="art-caption"><div><span className="eyebrow">{t(featured ? music ? 'landing.music' : 'landing.beats' : 'landing.decorative')}</span>{featured && <h3><Link to={`/track/${featured.id}`}>{featured.title}</Link></h3>}</div>{featured && <span>{featured.genre}</span>}</div>
          </div>
        </div>
      </div>
      <div className="scene-bottom"><AudioLines className="icon accent" aria-hidden="true" /><span>{t(tracks.length ? 'landing.playNote' : 'landing.listenNote')}</span><div className="scene-meter" aria-hidden="true"><span /></div></div>
    </div>
  </section>;
}
