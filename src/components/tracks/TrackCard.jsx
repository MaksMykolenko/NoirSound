import React from 'react';
import TrackSourceIcon from './TrackSourceIcon';
import { canPlayTrack } from '../../utils/trackPlayback';
import { Link } from 'react-router-dom';
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

export default function TrackCard({ track, tracksContext = [], queueSource = null, releaseYear = null, variant = 'track' }) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTracks, toggleLikeTrack } = usePlayerStore();
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);
  if (!track?.id) return null;
  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = likedTracks.includes(track.id);
  const canPlay = canPlayTrack(track);
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
        <Link to={playerTrackHref(track)} onKeyDown={contextMenuProps.onKeyDown}
          aria-label={variant === 'release' ? t('profile.openRelease', { title: track.title }) : t('media.openTrack', { title: track.title, artist: track.artistName })}
          className="block h-full w-full">
          <FallbackCover src={track.coverUrl} title={track.title} artistName={track.artistName}
            genre={track.genre} className="h-full w-full" imageClassName="object-cover" loading="lazy" />
        </Link>
        <div className="ns-track-card__actions">
          <button type="button" disabled={Boolean(track.previewExternalId)} onClick={() => toggleLikeTrack(track.id)}
            className="ns-media-action ns-media-action--card" aria-pressed={isLiked}
            aria-label={`${t(isLiked ? 'trackPage.unlike' : 'trackPage.like')} ${track.title}`}>
            <TrackSaveIcon saved={isLiked} />
          </button>
          <button type="button" disabled={Boolean(track.previewExternalId)} onClick={openFromButton} className="ns-media-action ns-media-action--card"
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
          <Link to={playerTrackHref(track)} onKeyDown={contextMenuProps.onKeyDown} title={track.title}
            className={`block truncate ${isCurrent ? 'text-brand-red' : ''}`}>{track.title}</Link>
        </h3>
        <div className="ns-media-byline">
          <TrackSourceIcon track={track} />
          {track.explicit && <span className="ns-explicit-badge" title={t('media.explicit')}>E</span>}
          <ArtistLabel track={track} />
        </div>
        <div className="ns-track-card__details">
          <TrackTypeBadge track={track} />
          <BeatMetadataInline track={track} limit={2} />
          {variant === 'release' && releaseYear !== null && <p>{releaseYear}</p>}
        </div>
        <span className="sr-only">{getLocalizedGenre(track.genre)} · {formatDuration(track.duration)}</span>
        {!canPlay && <span className="ns-media-meta">{t(track.playbackMode === 'LINK_OUT' ? 'externalMusic.linkOutNote' : 'trackPage.audioUnavailable')}</span>}
      </div>
    </article>
  );
}

function ArtistLabel({track}) {
  return track.artistId ? <Link to={`/artist/${track.artistId}`} className="min-w-0 truncate hover:underline" title={track.artistName}>{track.artistName}</Link> : <span className="min-w-0 truncate" title={track.artistName}>{track.artistName}</span>;
}
