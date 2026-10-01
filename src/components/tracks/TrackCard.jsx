import React, {useState,useRef,useCallback} from 'react';
import TrackSourceIcon from './TrackSourceIcon';
import { canPlayTrack } from '../../utils/trackPlayback';
import { Link,useNavigate } from 'react-router-dom';
import {saveCatalogTrack} from '../../api/externalCatalog';
import {useUserStore} from '../../store/userStore';
import { useTranslation } from 'react-i18next';
import { Play, Pause, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import FallbackCover from '../ui/FallbackCover';
import { playerTrackHref } from '../../utils/playerTrackPresentation';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import { BeatMetadataInline, TrackTypeBadge } from './TrackContentMeta';
import { TrackSaveIcon, TrackPlayingIndicator } from './TrackVisuals';

export default function TrackCard({ track:provided, tracksContext = [], queueSource = null, releaseYear = null, variant = 'track' }) {
  const { t } = useTranslation();
  const navigate=useNavigate();
  const [saved,setSaved]=useState(null),[pending,setPending]=useState(false),[error,setError]=useState('');
  const request=useRef(null);
  const track=saved?.inputId===provided?.id?saved.track:provided;
  const resolveTrack=useCallback(async()=>{
    if(!track?.previewExternalId)return track;
    if(request.current?.id===track.id)return request.current.promise;
    const owner=useUserStore.getState().user;
    if(!owner){useUserStore.getState().setAuthModalOpen(true,'login');throw new Error('Sign in to save this track.');}
    setPending(true);setError('');
    const promise=saveCatalogTrack(track).then(value=>{
      if(useUserStore.getState().user?.id!==owner.id)throw new Error('EXTERNAL_BETA_FORBIDDEN');
      setSaved({inputId:provided.id,track:value});return value;
    }).finally(()=>{request.current=null;setPending(false);});
    request.current={id:track.id,promise};return promise;
  },[track,provided?.id]);
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTracks, toggleLikeTrack } = usePlayerStore();
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track,{resolveTrack});
  if (!track?.id) return null;
  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = likedTracks.includes(track.id);
  const canPlay = canPlayTrack(track);
  const originals=track.primarySources?.filter(s=>s.matchStatus==='CONFIRMED') || (track.canonicalUrl?[{provider:track.provider,canonicalUrl:track.canonicalUrl}]:[]);
  const openTrack=async event=>{
    if(!track.previewExternalId || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button!==0)return;
    event.preventDefault();
    try {const value=await resolveTrack();navigate(`/track/${value.id}`);}catch(e){setError(e.message);}
  };
  const saveLike=async()=>{try{if(!track.previewExternalId){await toggleLikeTrack(track.id);return;}const value=await resolveTrack();await toggleLikeTrack(value.id);}catch(e){setError(e.message);}};
  const handlePlay = (event) => {
    event.stopPropagation();
    if (!canPlay) return;
    if (isCurrent && track.playbackMode !== 'OFFICIAL_EMBED') togglePlay();
    else playTrack(track, tracksContext.length ? tracksContext : [track], queueSource);
  };
  return (
    <article onContextMenu={contextMenuProps.onContextMenu} data-track-id={track.id}
      aria-current={isCurrent ? 'true' : undefined}
      className={`ns-media-card ns-track-card group ${variant === 'release' ? 'ns-artist-release-card' : ''}`}>
      <div className="ns-media-card__artwork ns-track-card__artwork">
        <Link to={playerTrackHref(track)} onClick={openTrack} onKeyDown={contextMenuProps.onKeyDown}
          aria-label={variant === 'release' ? t('profile.openRelease', { title: track.title }) : t('media.openTrack', { title: track.title, artist: track.artistName })}
          className="block h-full w-full">
          <FallbackCover src={track.coverUrl} title={track.title} artistName={track.artistName}
            genre={track.genre} className="h-full w-full" imageClassName="object-cover" loading="lazy" />
        </Link>
        <div className="ns-track-card__actions">
          <button type="button" disabled={pending} onClick={saveLike}
            className="ns-media-action ns-media-action--card" aria-pressed={isLiked}
            aria-label={`${t(isLiked ? 'trackPage.unlike' : 'trackPage.like')} ${track.title}`}>
            <TrackSaveIcon saved={isLiked} />
          </button>
          <button type="button" disabled={pending} onClick={openFromButton} className="ns-media-action ns-media-action--card"
            aria-label={t('playlists.moreActionsFor', { title: track.title })} aria-haspopup="menu">
            <MoreHorizontal size={20} />
          </button>
        </div>
        {isPlayingThis && <TrackPlayingIndicator className="ns-track-card__playing" />}
        <button type="button" onClick={handlePlay} disabled={!canPlay}
          className={`ns-card-play ${isCurrent ? 'is-current' : ''}`}
          aria-label={canPlay ? t(isPlayingThis ? 'playlists.pauseTrack' : 'playlists.playTrack', { title: track.title }) : t('trackPage.audioUnavailable')}>
          {isPlayingThis ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
      </div>
      <div className="ns-track-card__body">
        <h3 className="ns-card-title min-w-0">
          <Link to={playerTrackHref(track)} onClick={openTrack} onKeyDown={contextMenuProps.onKeyDown} title={track.title}
            className={`block truncate ${isCurrent ? 'text-brand-red' : ''}`}>{track.title}</Link>
        </h3>
        <div className="ns-media-byline">
          {originals.length?originals.map(source=><TrackSourceIcon key={source.provider} provider={source.provider}/>):<TrackSourceIcon track={track}/>}
          {track.explicit && <span className="ns-explicit-badge" title={t('media.explicit')}>E</span>}
          <ArtistLabel track={track} />
        </div>
        <div className="ns-track-card__details">
          <TrackTypeBadge track={track} />
          <BeatMetadataInline track={track} limit={2} />
          {variant === 'release' && releaseYear !== null && <p>{releaseYear}</p>}
        </div>
        <span className="sr-only">{getLocalizedGenre(track.genre)} · {formatDuration(track.duration)}</span>
        {track.playbackSource==='external'&&<div className="flex flex-wrap gap-x-2">{originals.map(source=><a key={source.provider} className="ns-media-meta underline" href={source.canonicalUrl} target="_blank" rel="noopener noreferrer">{source.provider==='APPLE_MUSIC'?'Apple Music':source.provider?.toLowerCase().replace(/^./,c=>c.toUpperCase())}</a>)}</div>}
        {error&&<span role="alert" className="text-xs text-rose-400">{t('externalMusic.error')}</span>}
        {!canPlay && track.playbackMode!=='LINK_OUT'&&<span className="ns-media-meta">{t('trackPage.audioUnavailable')}</span>}
      </div>
    </article>
  );
}

function ArtistLabel({track}) {
  return track.artistId ? <Link to={`/artist/${track.artistId}`} className="min-w-0 truncate hover:underline" title={track.artistName}>{track.artistName}</Link> : <span className="min-w-0 truncate" title={track.artistName}>{track.artistName}</span>;
}
