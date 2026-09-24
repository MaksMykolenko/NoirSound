import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, MoreHorizontal, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../../store/playerStore';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import { formatDuration } from '../../utils/formatTime';
import FallbackCover from '../ui/FallbackCover';
import { TrackTypeBadge, BeatMetadataInline } from './TrackContentMeta';
import { TrackSaveIcon } from './TrackVisuals';

export default function FeaturedTrack({ track, tracksContext = [], compact = false }) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTracks, toggleLikeTrack } = usePlayerStore();
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);
  if (!track?.id) return null;

  const active = currentTrack?.id === track.id;
  const playing = active && isPlaying;
  const saved = likedTracks.includes(track.id);
  const canPlay = track.isAvailable !== false && (track.isStreamable ?? Boolean(track.audioUrl));
  const handlePlay = () => {
    if (!canPlay) return;
    if (active) togglePlay();
    else playTrack(track, tracksContext.length ? tracksContext : [track]);
  };

  return (
    <div className={`ns-featured-track ${compact ? 'ns-featured-track--compact' : ''}`}
      data-track-id={track.id} onContextMenu={contextMenuProps.onContextMenu}
      aria-current={active ? 'true' : undefined}>
      <Link to={`/track/${track.id}`} className="ns-featured-track__cover"
        aria-label={t('profile.openRelease', { title: track.title })}>
        <FallbackCover src={track.coverUrl} title={track.title} artistName={track.artistName}
          genre={track.genre} className="h-full w-full" imageClassName="object-cover" />
      </Link>
      <div className="ns-featured-track__body">
        <span className="ns-featured-track__caption">{t('discover.trendingNow')}</span>
        <h2><Link to={`/track/${track.id}`} title={track.title}
          onKeyDown={contextMenuProps.onKeyDown}>{track.title}</Link></h2>
        <div className="ns-media-byline">
          <TrackTypeBadge track={track} />
          <Link to={`/artist/${track.artistId}`} title={track.artistName}>{track.artistName}</Link>
          <span>·</span><span>{formatDuration(track.duration)}</span>
        </div>
        <BeatMetadataInline track={track} limit={2} />
        <div className="ns-featured-track__actions">
          <button type="button" className="ns-track-main-play" disabled={!canPlay} onClick={handlePlay}
            aria-label={canPlay ? t(playing ? 'playlists.pauseTrack' : 'playlists.playTrack', { title: track.title }) : t('trackPage.audioUnavailable')}>
            {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>
          <button type="button" className="ns-media-action" aria-pressed={saved}
            onClick={() => toggleLikeTrack(track.id)}
            aria-label={`${t(saved ? 'trackPage.unlike' : 'trackPage.like')} ${track.title}`}>
            <TrackSaveIcon saved={saved} size={24} />
          </button>
          <button type="button" className="ns-media-action" aria-haspopup="menu" onClick={openFromButton}
            aria-label={t('playlists.moreActionsFor', { title: track.title })}>
            <MoreHorizontal size={24} />
          </button>
          <Link to={`/track/${track.id}`} className="ns-featured-track__details">
            {t('discover.viewRelease')}<ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
