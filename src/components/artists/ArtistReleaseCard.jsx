import React from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../../store/playerStore';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import FallbackCover from '../ui/FallbackCover';

function releaseYear(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
}

export default function ArtistReleaseCard({ track, tracksContext, queueSource }) {
  const { t } = useTranslation();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);
  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const canPlay = track.isStreamable ?? Boolean(track.audioUrl);
  const year = releaseYear(track.releaseDate) ?? releaseYear(track.createdAt);

  const handlePlay = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canPlay) return;
    if (isCurrent) {
      togglePlay();
      return;
    }
    playTrack(track, tracksContext?.length ? tracksContext : [track], queueSource);
  };

  return (
    <article
      className="ns-artist-release-card group"
      data-track-id={track.id}
      onContextMenu={contextMenuProps.onContextMenu}
    >
      <Link
        to={`/track/${track.id}`}
        onKeyDown={contextMenuProps.onKeyDown}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={t('profile.openRelease', { title: track.title })}
      />

      <div className="pointer-events-none relative z-[1]">
        <div className="ns-artist-release-card__artwork relative aspect-square overflow-hidden rounded-md">
          <FallbackCover
            src={track.coverUrl}
            title={track.title}
            artistName={track.artistName}
            genre={track.genre}
            className="h-full w-full"
            imageClassName="object-cover"
            loading="lazy"
          />

          <button
            type="button"
            onClick={handlePlay}
            disabled={!canPlay}
            className={`pointer-events-auto absolute bottom-2 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-brand-red text-[var(--ns-on-accent)] shadow-md transition-opacity disabled:cursor-not-allowed disabled:opacity-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${isCurrent ? 'sm:opacity-100' : ''}`}
            aria-label={isPlayingThis
              ? t('playlists.pauseTrack', { title: track.title })
              : t('playlists.playTrack', { title: track.title })}
          >
            {isPlayingThis
              ? <Pause size={18} fill="currentColor" />
              : <Play size={18} className="translate-x-px" fill="currentColor" />}
          </button>

          <button
            type="button"
            onClick={openFromButton}
            className="pointer-events-auto absolute right-2 top-2 z-10 ns-icon-button !min-h-10 !min-w-10 bg-zinc-950/85 text-zinc-300 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100"
            aria-label={t('playlists.moreActionsFor', { title: track.title })}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        <div className="mt-3 min-w-0 px-0.5">
          <h3 className={`ns-artist-release-card__title text-ns-body-sm font-semibold ${isCurrent ? 'text-brand-red' : 'text-zinc-200'}`}>
            {track.title}
          </h3>
          {year !== null && (
            <p className="mt-1 truncate font-sans tabular-nums text-ns-meta text-zinc-500">
              {year}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
