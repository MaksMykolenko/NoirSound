import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Heart, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import FallbackCover from '../ui/FallbackCover';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import { BeatMetadataInline, TrackTypeBadge } from './TrackContentMeta';

export default function TrackCard({ track, tracksContext = [] }) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTracks, toggleLikeTrack } = usePlayerStore();
  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = likedTracks.includes(track.id);
  const canPlay = track.isStreamable ?? Boolean(track.audioUrl);
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);
  const genre = getLocalizedGenre(track.genre);

  const handlePlayClick = (event) => {
    event.stopPropagation();
    if (!canPlay) return;
    if (isCurrent) togglePlay();
    else playTrack(track, tracksContext.length ? tracksContext : [track]);
  };

  return (
    <div onContextMenu={contextMenuProps.onContextMenu} data-track-id={track.id}
      aria-current={isCurrent ? 'true' : undefined} className="ns-media-card ns-track-card group">
      <div className="ns-media-card__artwork ns-track-card__artwork relative aspect-square">
        <Link to={`/track/${track.id}`} onKeyDown={contextMenuProps.onKeyDown}
          aria-label={t('media.openTrack', { title: track.title, artist: track.artistName })}
          className="block h-full w-full">
          <FallbackCover src={track.coverUrl} title={track.title} artistName={track.artistName}
            genre={track.genre} className="h-full w-full" imageClassName="object-cover" loading="lazy" />
        </Link>
        <button type="button" onClick={handlePlayClick} disabled={!canPlay}
          className={`ns-card-play ${isCurrent ? 'is-current' : ''}`}
          aria-label={canPlay ? t(isPlayingThis ? 'playlists.pauseTrack' : 'playlists.playTrack', { title: track.title }) : t('trackPage.audioUnavailable')}>
          {isPlayingThis ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
      </div>
      <div className="ns-track-card__body">
        <h3 className="ns-card-title min-w-0">
          <Link to={`/track/${track.id}`} onKeyDown={contextMenuProps.onKeyDown}
            title={track.title} className={`block truncate ${isCurrent ? 'text-brand-red' : ''}`}>
            {track.title}
          </Link>
        </h3>
        <div className="ns-media-byline">
          <TrackTypeBadge track={track} />
          {track.explicit && <span className="ns-explicit-badge" title={t('media.explicit')}>E</span>}
          <Link to={`/artist/${track.artistId}`} className="min-w-0 truncate hover:underline" title={track.artistName}>
            {track.artistName}
          </Link>
        </div>
        {genre && <p className="ns-media-meta truncate" title={genre}>{genre}</p>}
        <BeatMetadataInline track={track} limit={4} />
        <div className="ns-track-card__footer">
          <span className="ns-media-duration" title={t('trackPage.duration')}>
            {formatDuration(track.duration)}
          </span>
          <button type="button" onClick={() => toggleLikeTrack(track.id)}
            className="ns-media-action ns-media-action--card" aria-pressed={isLiked}
            aria-label={`${t(isLiked ? 'trackPage.unlike' : 'trackPage.like')} ${track.title}`}>
            <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
          <button type="button" onClick={openFromButton} className="ns-media-action ns-media-action--card"
            aria-label={t('playlists.moreActionsFor', { title: track.title })} aria-haspopup="menu">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
