import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FallbackCover from '../ui/FallbackCover';
import { usePlayerStore } from '../../store/playerStore';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';

function QuickPick({ track, tracks }) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore();
  const { contextMenuProps } = useTrackContextMenu(track);
  const active = currentTrack?.id === track.id;
  const playing = active && isPlaying;
  const canPlay = track.isAvailable !== false && (track.isStreamable ?? Boolean(track.audioUrl));
  const handlePlay = () => {
    if (!canPlay) return;
    if (active) togglePlay();
    else playTrack(track, tracks);
  };

  return (
    <div className="ns-quick-track group" data-track-id={track.id}
      aria-current={active ? 'true' : undefined} onContextMenu={contextMenuProps.onContextMenu}>
      <Link to={`/track/${track.id}`} className="ns-quick-track__cover"
        aria-label={t('profile.openRelease', { title: track.title })}>
        <FallbackCover src={track.coverUrl} title={track.title} artistName={track.artistName}
          genre={track.genre} className="h-full w-full" imageClassName="object-cover" />
      </Link>
      <div className="ns-quick-track__body">
        <Link to={`/track/${track.id}`} title={track.title} onKeyDown={contextMenuProps.onKeyDown}
          className={`ns-quick-track__title ${active ? 'text-brand-red' : ''}`}>{track.title}</Link>
        <Link to={`/artist/${track.artistId}`} title={track.artistName}
          className="ns-quick-track__artist">{track.artistName}</Link>
      </div>
      <button type="button" className="ns-quick-track__play" disabled={!canPlay} onClick={handlePlay}
        aria-label={canPlay ? t(playing ? 'playlists.pauseTrack' : 'playlists.playTrack', { title: track.title }) : t('trackPage.audioUnavailable')}>
        {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
    </div>
  );
}

export default function HomeQuickPicks({ tracks = [], title, subtitle }) {
  const { t } = useTranslation();
  const validTracks = tracks.filter(track => track?.id);
  if (!validTracks.length) return null;

  return (
    <section className="space-y-3" aria-label={title || t('home.continueListening')}>
      <div>
        <h2 className="ns-section-title">{title || t('discover.trendingNow')}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      <div className="ns-quick-tracks">
        {validTracks.slice(0, 6).map(track => <QuickPick key={track.id} track={track} tracks={validTracks} />)}
      </div>
    </section>
  );
}
