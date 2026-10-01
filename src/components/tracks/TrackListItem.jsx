import React from 'react';
import TrackSourceIcon from './TrackSourceIcon';
import { canPlayTrack, canQueueTrack } from '../../utils/trackPlayback';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Plus, Check, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import { formatNumber } from '../../utils/formatLocale';
import FallbackCover from '../ui/FallbackCover';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import { BeatMetadataInline, TrackTypeBadge } from './TrackContentMeta';
import { TrackSaveIcon, TrackPlayingIndicator } from './TrackVisuals';

export default function TrackListItem({ track, index, tracksContext = [], onRemoveFromPlaylist,
  queueSource = null, compact = false, showMobileLike = false, role }) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTracks, toggleLikeTrack,
    queue, addToQueue, removeFromQueue } = usePlayerStore();
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track, {
    removeFromPlaylist: onRemoveFromPlaylist ? () => onRemoveFromPlaylist(track) : undefined,
  });

  if (!track || !track.id) return null;

  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = likedTracks.includes(track.id);
  const inQueue = queue.some((item) => item.id === track.id);
  const canPlay = canPlayTrack(track);
  const handlePlay = () => {
    if (!canPlay) return;
    if (isCurrent && track.playbackMode !== 'OFFICIAL_EMBED') togglePlay();
    else playTrack(track, tracksContext.length ? tracksContext : [track], queueSource);
  };
  const genre = getLocalizedGenre(track.genre);
  return (
    <div onContextMenu={contextMenuProps.onContextMenu} data-track-id={track.id} role={role}
      aria-current={isCurrent ? 'true' : undefined}
      className={`ns-track-row group ${compact ? 'ns-track-row--compact' : ''}`}>
      <div className="ns-track-row__number" aria-hidden="true">
        {isPlayingThis ? <TrackPlayingIndicator /> : Number.isInteger(index) ? index + 1 : null}
      </div>
      <div className="ns-track-row__leading">
        <FallbackCover src={track?.coverUrl} title={track?.title} artistName={track?.artistName}
          genre={track?.genre} className="h-full w-full rounded" imageClassName="object-cover" />
        <button type="button" onClick={handlePlay} disabled={!canPlay}
          className={`ns-track-row__play ${isPlayingThis ? 'is-playing' : ''}`}
          aria-label={canPlay ? t(isPlayingThis ? 'playlists.pauseTrack' : 'playlists.playTrack', { title: track.title }) : t('trackPage.audioUnavailable')}>
          {isPlayingThis ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
      </div>
      <div className="ns-track-row__identity">
        <Link to={`/track/${track.id}`} title={track.title} onKeyDown={contextMenuProps.onKeyDown}
          className={`ns-track-row__title block truncate ${isCurrent ? 'text-brand-red' : ''}`}>
          {track.title}
          {isCurrent && <span className="sr-only"> — {t('playlists.currentlyPlaying')}</span>}
        </Link>
        <div className="ns-media-byline">
          <TrackSourceIcon track={track} />
          <TrackTypeBadge track={track} />
          {track.explicit && <span className="ns-explicit-badge" title={t('media.explicit')}>E</span>}
          <ArtistLabel track={track} />
        </div>
        <BeatMetadataInline track={track} limit={2} />
        {!canPlay && <span className="ns-media-meta">{t('trackPage.audioUnavailable')}</span>}
      </div>
      {!compact && <div className="ns-track-row__secondary ns-media-meta">
        <span className="block truncate" title={genre}>{genre}</span>
        {track.playbackSource !== 'external' && <span className="block tabular-nums"><span>{formatNumber(track.plays || 0)}</span> {t('trackPage.plays')}</span>}
      </div>}
      <span className="ns-track-row__duration ns-media-duration" title={t('trackPage.duration')}>
        {formatDuration(track.duration)}
      </span>
      <div className="ns-track-row__actions">
        <button type="button" onClick={() => toggleLikeTrack(track.id)}
          className={`ns-media-action ${showMobileLike ? '' : 'ns-track-row__desktop-action'}`}
          aria-label={`${t(isLiked ? 'trackPage.unlike' : 'trackPage.like')} ${track.title}`} aria-pressed={isLiked}>
          <TrackSaveIcon saved={isLiked} />
        </button>
        {canQueueTrack(track) && !compact && <button type="button"
          onClick={() => inQueue ? removeFromQueue(track.id) : addToQueue(track)}
          className="ns-media-action ns-track-row__desktop-action" aria-pressed={inQueue}
          aria-label={t(inQueue ? 'media.removeFromQueue' : 'media.addToQueue', { title: track.title })}>
          {inQueue ? <Check size={16} /> : <Plus size={16} />}
        </button>}
        <button type="button" onClick={openFromButton} className="ns-media-action"
          aria-label={t('playlists.moreActionsFor', { title: track.title })} aria-haspopup="menu">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}

function ArtistLabel({track}) {
  return track.artistId ? <Link to={`/artist/${track.artistId}`} className="min-w-0 truncate hover:underline" title={track.artistName}>{track.artistName}</Link> : <span className="min-w-0 truncate" title={track.artistName}>{track.artistName}</span>;
}
