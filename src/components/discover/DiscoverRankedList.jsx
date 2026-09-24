import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Heart, Flame, MoreHorizontal, Plus, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import { formatNumber } from '../../utils/formatLocale';
import FallbackCover from '../ui/FallbackCover';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import { TrackTypeBadge } from '../tracks/TrackContentMeta';

function RankedTrack({ track, index, tracks }) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTracks, toggleLikeTrack, queue, addToQueue, removeFromQueue } = usePlayerStore();
  const { contextMenuProps, openFromButton } = useTrackContextMenu(track);
  const inQueue = queue.some(item => item.id === track.id);
        const isCurrent = currentTrack?.id === track.id;
        const isPlayingThis = isCurrent && isPlaying;
        const isLiked = likedTracks.includes(track.id);
        const rank = index + 1;
        const canPlay = track.isStreamable ?? Boolean(track.audioUrl);
        const genre = getLocalizedGenre(track.genre);

        // Rank styling badges
        const rankBadge = rank === 1 ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 font-mono text-xs font-black text-black shadow-md ">
            #1
          </span>
        ) : rank === 2 ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-300 font-mono text-xs font-black text-black shadow-sm">
            #2
          </span>
        ) : rank === 3 ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-800 font-mono text-xs font-bold text-amber-100 shadow-sm">
            #3
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center font-mono text-xs font-semibold text-zinc-500">
            {rank < 10 ? `0${rank}` : rank}
          </span>
        );

        return (
          <div
            key={track.id}
            data-track-id={track.id}
            onContextMenu={contextMenuProps.onContextMenu}
            role="listitem"
            aria-current={isCurrent ? 'true' : undefined}
            className={`group flex items-center gap-2 sm:gap-3.5 rounded-xl border p-2.5 transition-all duration-150 ${
              isCurrent
                ? 'border-brand-red/40 bg-brand-red/5'
                : 'border-zinc-900/60 bg-zinc-950/40 hover:border-zinc-800 hover:bg-zinc-900/40'
            }`}
          >
            {/* Rank badge */}
            <div className="shrink-0 flex items-center justify-center w-7">
              {rankBadge}
            </div>

            {/* Thumbnail with hover play overlay */}
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-800 border border-zinc-800">
              <FallbackCover
                src={track?.coverUrl}
                title={track?.title}
                artistName={track?.artistName}
                genre={track?.genre}
                className="h-full w-full"
                imageClassName="object-cover"
              />

              <button
                type="button"
                onClick={() => {
                  if (!canPlay) return;
                  if (isCurrent) togglePlay();
                  else playTrack(track, tracks, null);
                }}
                disabled={!canPlay}
                className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity cursor-pointer ${
                  isPlayingThis ? 'opacity-100 text-brand-red' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 text-white'
                }`}
                aria-label={canPlay ? t(isPlayingThis ? 'playlists.pauseTrack' : 'playlists.playTrack', { title: track.title }) : t('trackPage.audioUnavailable')}
              >
                {isPlayingThis ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
              </button>
            </div>

            {/* Title & Artist */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  to={`/track/${track.id}`}
                  onKeyDown={contextMenuProps.onKeyDown}
                  className={`block truncate font-semibold text-sm transition-colors hover:underline ${
                    isCurrent ? 'text-brand-red' : 'text-zinc-100 hover:text-white'
                  }`}
                  title={track.title}
                >
                  {track.title}
                </Link>
                <TrackTypeBadge track={track} />
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Link
                  to={`/artist/${track.artistId}`}
                  className="truncate hover:text-zinc-200 hover:underline"
                  title={track.artistName}
                >
                  {track.artistName}
                </Link>
                {genre && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 truncate">{genre}</span>
                  </>
                )}
                {track.beatBpm && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="font-mono text-zinc-500">{track.beatBpm} BPM</span>
                  </>
                )}
              </div>
            </div>

            {/* Plays / Trending metric */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
              <Flame size={12} className="text-amber-500/80" />
              <span>{formatNumber(track.plays ?? track.playCount ?? 0)}</span>
            </div>

            {/* Duration */}
            <span className="text-xs font-mono text-zinc-500 shrink-0">
              {formatDuration(track.duration)}
            </span>

            {/* Quick Like Button */}
            <button
              type="button"
              onClick={() => toggleLikeTrack(track.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                isLiked
                  ? 'text-brand-red'
                  : 'text-zinc-500 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 hover:text-zinc-200'
              }`}
              aria-pressed={isLiked}
              aria-label={`${t(isLiked ? 'trackPage.unlike' : 'trackPage.like')} ${track.title}`}
            >
              <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
            {canPlay && <button type="button" onClick={() => inQueue ? removeFromQueue(track.id) : addToQueue(track)}
              className="ns-media-action hidden sm:inline-flex" aria-pressed={inQueue}
              aria-label={t(inQueue ? 'media.removeFromQueue' : 'media.addToQueue', { title: track.title })}>
              {inQueue ? <Check size={15} /> : <Plus size={15} />}
            </button>}
            <button type="button" onClick={openFromButton} className="ns-media-action shrink-0" aria-haspopup="menu"
              aria-label={t('playlists.moreActionsFor', { title: track.title })}><MoreHorizontal size={16} /></button>
          </div>
        );
}

export default function DiscoverRankedList({ tracks = [] }) {
  const validTracks = (Array.isArray(tracks) ? tracks : []).filter(track => Boolean(track?.id));
  return <div className="space-y-1.5" role="list">
    {validTracks.map((track, index) => <RankedTrack key={track.id} track={track} index={index} tracks={validTracks} />)}
  </div>;
}
