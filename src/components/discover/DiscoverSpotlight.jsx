import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Heart, Disc3, Volume2, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import FallbackCover from '../ui/FallbackCover';
import { TrackTypeBadge } from '../tracks/TrackContentMeta';

export default function DiscoverSpotlight({ track, tracksContext = [] }) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTracks, toggleLikeTrack } = usePlayerStore();

  if (!track || !track.id) return null;

  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = likedTracks.includes(track.id);
  const canPlay = Boolean(track && (track.isStreamable ?? Boolean(track.audioUrl)));
  const localizedGenre = getLocalizedGenre(track.genre);

  const handlePlay = () => {
    if (!canPlay) return;
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, tracksContext.length ? tracksContext : [track]);
    }
  };

  return (
    <div data-testid="discover-spotlight" className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-[var(--ns-card-solid)] p-6 sm:p-8 group">

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
        {/* Left: Info & Controls */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Flame size={14} className="text-amber-500 fill-amber-500" />
              <span>{t('discover.trendingNow')}</span>
            </span>
            <TrackTypeBadge track={track} />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--ns-design-ink)] line-clamp-2">
              <Link
                to={`/track/${track.id}`}
                className="block break-words hover:text-brand-red transition-colors"
              >
                {track.title}
              </Link>
            </h2>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-300">
              <Link
                to={`/artist/${track.artistId}`}
                className="min-w-0 max-w-full font-medium text-zinc-200 hover:text-white hover:underline flex items-center gap-1.5"
              >
                <div className="h-5 w-5 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0">
                  <FallbackCover src={track?.artistAvatarUrl || track?.coverUrl} title={track?.artistName} />
                </div>
                <span className="truncate">{track.artistName}</span>
              </Link>
              <span className="text-zinc-600">•</span>
              <span className="max-w-full truncate text-zinc-400">{localizedGenre || track.genre}</span>
              {track.beatBpm && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-xs font-mono text-zinc-300 border border-zinc-700/50">
                    {track.beatBpm} BPM
                  </span>
                </>
              )}
              {track.beatKey && (
                <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-xs font-mono text-zinc-300 border border-zinc-700/50">
                  {track.beatKey}
                </span>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handlePlay}
              disabled={!canPlay}
              className="inline-flex items-center gap-2.5 rounded-full bg-brand-red px-6 py-3 font-semibold text-white transition-all hover:bg-brand-red/90 hover:scale-105 active:scale-95 cursor-pointer"
              aria-label={isPlayingThis ? t('discover.pauseSpotlight') : t('discover.playSpotlight')}
            >
              {isPlayingThis ? (
                <>
                  <Pause size={18} fill="currentColor" />
                  <span>{t('discover.pauseSpotlight')}</span>
                  {/* Mini bouncing equalizer */}
                  <span className="flex items-end gap-0.5 h-3.5 ml-1">
                    <span className="w-0.5 h-full bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-0.5 h-2/3 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-0.5 h-full bg-white rounded-full animate-bounce" />
                  </span>
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  <span>{t('discover.playSpotlight')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => toggleLikeTrack(track.id)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all cursor-pointer ${
                isLiked
                  ? 'border-brand-red/50 bg-brand-red/10 text-brand-red'
                  : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-white'
              }`}
              aria-pressed={isLiked}
                  aria-label={`${t(isLiked ? 'trackPage.unlike' : 'trackPage.like')} ${track.title}`}
            >
              <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            </button>

            <Link
              to={`/track/${track.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
            >
              <Disc3 size={15} className="text-zinc-500" />
              <span>{t('discover.viewRelease')}</span>
            </Link>

            <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-xs text-zinc-500 font-mono">
              <Volume2 size={13} />
              <span>{formatDuration(track.duration)}</span>
            </span>
          </div>
        </div>

        {/* Right: Vinyl record & 3D Cover Art presentation */}
        <div className="relative shrink-0 self-center md:self-auto">
          <div className="relative h-44 w-44 sm:h-52 sm:w-52">
            {/* Spinning Vinyl Record behind the sleeve */}
            <div
              className={`absolute top-0 right-0 h-full w-full rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center transition-all duration-700 ease-out ${
                isPlayingThis
                  ? 'translate-x-12 sm:translate-x-16 rotate-180 animate-[spin_8s_linear_infinite]'
                  : 'translate-x-6 sm:translate-x-8 group-hover:translate-x-10'
              }`}
              style={{
                background: '#151517',
              }}
            >
              {/* Vinyl Grooves */}
              <div className="absolute inset-2 rounded-full border border-zinc-800/40 pointer-events-none" />
              <div className="absolute inset-5 rounded-full border border-zinc-800/50 pointer-events-none" />
              <div className="absolute inset-8 rounded-full border border-zinc-800/60 pointer-events-none" />
              <div className="absolute inset-12 rounded-full border border-zinc-800/70 pointer-events-none" />

              {/* Center Record Label */}
              <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden border border-brand-red/30 bg-[var(--ns-card-solid)] p-0.5 flex flex-col items-center justify-center text-center shadow-inner">
                <FallbackCover
                  src={track?.coverUrl}
                  title={track?.title}
                  artistName={track?.artistName}
                  genre={track?.genre}
                  className="h-full w-full rounded-full"
                  imageClassName="object-cover"
                />
                <div className="absolute h-2.5 w-2.5 rounded-full bg-black border border-zinc-700 pointer-events-none" />
              </div>
            </div>

            {/* Front Cover Sleeve */}
            <div className="relative z-10 h-full w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900 transition-transform duration-300 group-hover:scale-[1.02]">
              <FallbackCover
                src={track?.coverUrl}
                title={track?.title}
                artistName={track?.artistName}
                genre={track?.genre}
                className="h-full w-full"
                imageClassName="object-cover"
              />
              {/* Subtle vinyl reflection overlay */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
