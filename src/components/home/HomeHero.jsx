import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MUSIC_GENRES } from '../../constants/musicGenres';

export default function HomeHero({ onDiscover, onUpload }) {
  const { t } = useTranslation();

  return (
    <section
      data-testid="home-hero"
      className="relative flex min-h-[240px] items-center overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950 sm:min-h-[260px]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-35"
        style={{ backgroundImage: "url('/images/hero_noir.png')" }}
      />
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative z-10 w-full max-w-3xl px-5 py-7 sm:px-8">
        <h1 className="max-w-2xl font-display text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl">
          {t('home.title')}
        </h1>
        <p className="mt-2.5 sm:mt-3 max-w-xl text-sm sm:text-[15px] text-zinc-300 leading-relaxed">
          {t('home.subtitle')}
        </p>

        <div className="mt-4 sm:mt-5 grid grid-cols-2 sm:flex gap-2 sm:gap-3">
          <button
            type="button"
            data-testid="home-hero-discover"
            onClick={onDiscover}
            className="ns-button-primary px-3 sm:px-5 text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
          >
            <span>{t('actions.discoverMusic')}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="home-hero-upload"
            onClick={onUpload}
            className="ns-button-secondary px-3 sm:px-5 text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest cursor-pointer text-center"
          >
            {t('actions.uploadTrack')}
          </button>
        </div>

        <p className="mt-4 hidden font-mono text-[9px] uppercase tracking-wider text-zinc-500 sm:block">
          {t('home.genreCount', { count: MUSIC_GENRES.length })}
        </p>
      </div>
    </section>
  );
}
