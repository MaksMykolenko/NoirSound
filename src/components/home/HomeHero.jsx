import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Pause, Heart, Disc3, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MUSIC_GENRES } from '../../constants/musicGenres';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/formatTime';
import { getLocalizedGenre } from '../../i18n/genreLabels';
import FallbackCover from '../ui/FallbackCover';

export default function HomeHero({
  onDiscover,
  onUpload,
  featuredTrack = null,
  tracksContext = [],
}) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTracks = [], toggleLikeTrack } = usePlayerStore();

  const track = featuredTrack;
  const isCurrent = Boolean(track && currentTrack?.id === track.id);
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = Boolean(track && likedTracks?.includes(track.id));
  const canPlay = Boolean(track && (track.isStreamable ?? Boolean(track.audioUrl)));
  const localizedGenre = track?.genre ? getLocalizedGenre(track.genre) : '';

  const handlePlayClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!canPlay) return;
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, tracksContext.length > 0 ? tracksContext : [track]);
    }
  };

  return (
    <section
      data-testid="home-hero"
      className="ns-home-hero relative flex min-h-[260px] items-center justify-between overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950 p-6 sm:p-8 sm:min-h-[290px] gap-6"
    >
      {/* Background imagery and gradients */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25"
        style={{ backgroundImage: "url('/images/hero_noir.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/85 to-zinc-950/90" />

      {/* Atmospheric red ambient glow in corner */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-brand-red/15 blur-3xl pointer-events-none" />

      {/* Left Column: Heading and CTAs */}
      <div className="relative z-10 w-full min-w-0 max-w-xl">
        <h1 className="ns-home-hero-title max-w-xl text-white">
          {t('home.title')}
        </h1>
        <p className="mt-2.5 sm:mt-3 max-w-lg text-sm sm:text-[15px] text-zinc-300 leading-relaxed">
          {t('home.subtitle')}
        </p>

        <div className="mt-5 grid grid-cols-2 sm:flex gap-2 sm:gap-3">
          <button
            type="button"
            data-testid="home-hero-discover"
            onClick={onDiscover}
            className="ns-button-primary px-3 sm:px-5 text-ns-label sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-lg shadow-brand-red/20"
          >
            <span>{t('actions.discoverMusic')}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="home-hero-upload"
            onClick={onUpload}
            className="ns-button-secondary px-3 sm:px-5 text-ns-label sm:text-sm cursor-pointer text-center hover:border-zinc-600"
          >
            {t('actions.uploadTrack')}
          </button>
        </div>

        <p className="mt-4 hidden font-sans tabular-nums text-ns-meta uppercase tracking-ns-label text-zinc-400 sm:block">
          {t('home.genreCount', { count: MUSIC_GENRES.length })}
        </p>
      </div>

      {/* Right Column: Trending/Featured Spotlight Deck (Desktop) */}
      <div
        className="relative z-10 hidden xl:flex items-center gap-6 rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black p-5 shadow-2xl backdrop-blur-xl group shrink-0"
        data-testid="home-hero-vinyl-deck"
      >
        {track ? (
          <>
            {/* Left inside card: Track Details & Controls */}
            <div className="flex w-56 min-w-0 flex-col gap-4">
              {/* Trending now badge */}
              <div className="flex items-center gap-1.5">
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-amber-400 font-mono">
                  <Flame size={13} className="text-amber-500 fill-amber-500" />
                  <span>{t('discover.trendingNow', 'Trending now')}</span>
                </span>
                {track.genre && (
                  <>
                    <span className="text-zinc-600 text-[10px]" aria-hidden="true">•</span>
                    <span className="truncate text-[10px] font-mono uppercase text-zinc-400">
                      {localizedGenre || track.genre}
                    </span>
                  </>
                )}
              </div>

              {/* Title */}
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                  <Link
                    to={`/track/${track.id}`}
                    className="block truncate hover:text-brand-red transition-colors"
                    title={track.title}
                  >
                    “{track.title}”
                  </Link>
                </h2>

                {/* Artist line with avatar */}
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-300">
                  <Link
                    to={`/artist/${track.artistId || track.artist?.id || ''}`}
                    className="font-medium text-zinc-300 hover:text-white hover:underline flex min-w-0 items-center gap-1.5 truncate"
                  >
                    <div className="h-4 w-4 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0">
                      <FallbackCover src={track?.artistAvatarUrl || track?.coverUrl} title={track?.artistName} />
                    </div>
                    <span className="truncate">{track.artistName || track.artistProfile?.displayName || t('discover.artist', 'Artist')}</span>
                  </Link>
                  {track.duration ? (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="shrink-0 whitespace-nowrap text-zinc-500 font-mono text-[11px]">{formatDuration(track.duration)}</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Action buttons: Listen Now, Like, Track Details */}
              <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePlayClick}
                  disabled={!canPlay}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-brand-red px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-red/25 transition-all hover:bg-brand-red/90 hover:scale-105 active:scale-95 cursor-pointer"
                  aria-label={isPlayingThis ? t('discover.pauseSpotlight', 'Pause') : t('discover.playSpotlight', 'Listen Now')}
                >
                  {isPlayingThis ? (
                    <>
                      <Pause size={13} fill="currentColor" />
                      <span>{t('discover.pauseSpotlight', 'Pause')}</span>
                      <span className="flex items-end gap-0.5 h-3 ml-0.5" aria-hidden="true">
                        <span className="w-0.5 h-full bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-0.5 h-2/3 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-0.5 h-full bg-white rounded-full animate-bounce" />
                      </span>
                    </>
                  ) : (
                    <>
                      <Play size={13} fill="currentColor" />
                      <span>{t('discover.playSpotlight', 'Listen Now')}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggleLikeTrack?.(track.id)}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all cursor-pointer ${
                    isLiked
                      ? 'border-brand-red/50 bg-brand-red/10 text-brand-red'
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                  aria-pressed={isLiked}
                  aria-label={`${t(isLiked ? 'trackPage.unlike' : 'trackPage.like')} ${track.title}`}
                >
                  <Heart size={13} fill={isLiked ? 'currentColor' : 'none'} />
                </button>

                <Link
                  to={`/track/${track.id}`}
                  className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
                >
                  <Disc3 size={12} className="text-zinc-500" />
                  <span>{t('discover.viewRelease', 'Details')}</span>
                </Link>
              </div>
            </div>

            {/* Right inside card: Vinyl record & Cover Art sleeve */}
            <div className="relative shrink-0 pr-4 sm:pr-6">
              <div className="relative h-28 w-28 sm:h-32 sm:w-32">
                {/* Spinning Vinyl Record sliding out behind the sleeve */}
                <div
                  className={`absolute top-0 right-0 h-full w-full rounded-full bg-zinc-950 border border-zinc-800 shadow-2xl flex items-center justify-center transition-all duration-700 ease-out ${
                    isPlayingThis
                      ? 'translate-x-8 sm:translate-x-10 rotate-180 animate-[spin_6s_linear_infinite]'
                      : 'translate-x-4 sm:translate-x-5 group-hover:translate-x-7'
                  }`}
                  style={{
                    background: 'radial-gradient(circle, #1a1a1a 0%, #0d0d0d 40%, #050505 70%, #151515 90%, #0a0a0a 100%)',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.9), 0 8px 20px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* Vinyl Grooves */}
                  <div className="absolute inset-1.5 rounded-full border border-zinc-800/40 pointer-events-none" />
                  <div className="absolute inset-3.5 rounded-full border border-zinc-800/50 pointer-events-none" />
                  <div className="absolute inset-5.5 rounded-full border border-zinc-800/60 pointer-events-none" />

                  {/* Center Record Label with artwork */}
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full overflow-hidden border border-brand-red/30 bg-gradient-to-br from-brand-red/40 via-zinc-900 to-black p-0.5 flex flex-col items-center justify-center text-center shadow-inner relative">
                    <FallbackCover
                      src={track.coverUrl}
                      title={track.title}
                      artistName={track.artistName}
                      genre={track.genre}
                      className="h-full w-full rounded-full"
                      imageClassName="object-cover"
                    />
                    <div className="absolute h-1.5 w-1.5 rounded-full bg-black border border-zinc-700 pointer-events-none" />
                  </div>
                </div>

                {/* Front Cover Sleeve */}
                <div className="relative z-10 h-full w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900 shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]">
                  <FallbackCover
                    src={track?.coverUrl}
                    title={track?.title}
                    artistName={track?.artistName}
                    genre={track?.genre}
                    className="h-full w-full"
                    imageClassName="object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4 py-2">
            <div className="relative h-20 w-20 shrink-0 rounded-full border-2 border-zinc-800 bg-zinc-950 flex items-center justify-center shadow-inner">
              <span className="text-[8px] font-mono text-zinc-500 uppercase">NOIR</span>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-zinc-200">
                Underground Soundscape
              </div>
              <div className="flex items-end gap-1 h-4 pt-1" aria-hidden="true">
                <span className="w-1 h-1.5 bg-zinc-700 rounded-full" />
                <span className="w-1 h-2.5 bg-zinc-600 rounded-full" />
                <span className="w-1 h-3.5 bg-zinc-600 rounded-full" />
                <span className="w-1 h-2 bg-zinc-700 rounded-full" />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
