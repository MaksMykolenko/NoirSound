import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MUSIC_GENRES } from '../../constants/musicGenres';
import FeaturedTrack from '../tracks/FeaturedTrack';

export default function HomeHero({ onDiscover, onUpload, featuredTrack = null, tracksContext = [] }) {
  const { t } = useTranslation();
  return (
    <section
      data-testid="home-hero"
      className="ns-home-hero relative flex min-h-[260px] items-center justify-between overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950 p-6 sm:p-8 sm:min-h-[290px] gap-6"
    >
      {/* Left Column: Heading and CTAs */}
      <div className="relative z-10 w-full min-w-0 max-w-xl">
        <h1 className="ns-home-hero-title max-w-xl text-[var(--ns-text-primary)]">
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
            className="ns-button-primary px-3 sm:px-5 text-ns-label sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer "
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

      {featuredTrack && <div className="ns-home-featured hidden min-w-0 xl:block" data-testid="home-hero-vinyl-deck">
        <FeaturedTrack track={featuredTrack} tracksContext={tracksContext} compact />
      </div>}
    </section>
  );
}
