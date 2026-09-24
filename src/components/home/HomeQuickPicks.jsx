import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FallbackCover from '../ui/FallbackCover';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import { usePlayerStore } from '../../store/playerStore';

export default function HomeQuickPicks({ tracks = [], title, subtitle }) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore();

  const validTracks = (Array.isArray(tracks) ? tracks : [])
    .filter((t) => Boolean(t?.id));

  if (validTracks.length === 0) return null;

  const displayTracks = validTracks.slice(0, 6);

  return (
    <section className="space-y-3" aria-label={title || t('home.continueListening')}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--ns-design-ink)] flex items-center gap-2">
            <Flame size={16} className="text-amber-500 fill-amber-500" />
            <span>{title || t('discover.trendingNow') || 'Quick Picks'}</span>
          </h2>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {displayTracks.map((track) => {
          if (!track) return null;
          const isThisPlaying = currentTrack?.id === track.id && isPlaying;
          const isCurrent = currentTrack?.id === track.id;
          const canPlay = track.isStreamable ?? Boolean(track.audioUrl);

          const handlePlayClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!canPlay) return;
            if (isCurrent) {
              togglePlay();
            } else {
              playTrack(track, validTracks);
            }
          };

          return (
            <div
              key={track.id}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-md border p-1.5 transition-all ${
                isCurrent
                  ? 'border-brand-red/50 bg-zinc-900/90 shadow-sm '
                  : 'border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/80 hover:bg-zinc-850/80'
              }`}
            >
              {/* Cover Thumbnail with overlay Play button */}
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-zinc-950">
                <FallbackCover src={track.coverUrl} title={track.title} artistName={track.artistName}
                  genre={track.genre} loading="lazy" className="h-full w-full"
                  imageClassName="object-cover transition-transform duration-300 group-hover:scale-105" />

                {/* Always visible when playing, or visible on group hover */}
                <div
                  className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
                    isThisPlaying ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={handlePlayClick}
                    disabled={!canPlay}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-red text-white shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                    aria-label={canPlay ? t(isThisPlaying ? 'playlists.pauseTrack' : 'playlists.playTrack', { title: track.title }) : t('trackPage.audioUnavailable')}
                  >
                    {isThisPlaying ? (
                      <Pause size={12} fill="currentColor" />
                    ) : (
                      <Play size={12} fill="currentColor" className="ml-0.5" />
                    )}
                  </button>
                </div>

                {/* Animated equalizers when playing */}
                {isThisPlaying && (
                  <div className="absolute bottom-1 right-1 flex items-end gap-0.5 bg-black/60 px-1 py-0.5 rounded">
                    <span className="w-0.5 h-2 bg-brand-red rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-0.5 h-3 bg-brand-red rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-0.5 h-1.5 bg-brand-red rounded-full animate-bounce" />
                  </div>
                )}
              </div>

              {/* Title & Artist */}
              <div className="min-w-0 flex-1 pr-2">
                <Link
                  to={`/track/${track.id}`}
                  className="block truncate text-xs font-semibold text-zinc-100 hover:text-white transition-colors"
                >
                  {track?.title || 'Untitled Track'}
                </Link>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="truncate">
                    {track.artistName || track.artistProfile?.displayName || t('discover.artist', 'Artist')}
                  </span>
                  {track?.genre && (
                    <>
                      <span className="text-zinc-600" aria-hidden="true">·</span>
                      <span className="truncate text-zinc-500">{getLocalizedGenre(track.genre)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
