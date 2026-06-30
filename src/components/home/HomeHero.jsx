import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MUSIC_GENRES } from '../../constants/musicGenres';

export default function HomeHero({ onDiscover, onUpload }) {
  const { t } = useTranslation();

  return (
    <section
      data-testid="home-hero"
      className="relative min-h-[300px] sm:min-h-[320px] md:min-h-[340px] overflow-hidden rounded-[1.75rem] border border-zinc-800/70 bg-[var(--ns-hero-bg)] shadow-2xl flex items-center"
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50 scale-100 hover:scale-[1.02] transition-transform duration-[6000ms]"
        style={{ backgroundImage: "url('/images/hero_noir.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--ns-hero-overlay-strong)] via-[var(--ns-hero-overlay-medium)] to-[var(--ns-hero-overlay-soft)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--ns-hero-overlay-medium)] via-transparent to-[var(--ns-hero-overlay-soft)]" />

      <div className="relative z-10 w-full max-w-3xl px-5 py-7 sm:px-8 sm:py-8 md:px-10">
        <h1 className="max-w-2xl text-[2rem] sm:text-4xl md:text-5xl font-black font-display tracking-[-0.04em] text-white leading-[1.03]">
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

        <p className="hidden sm:block mt-4 text-[11px] font-semibold tracking-wide text-zinc-500">
          {t('home.genreCount', { count: MUSIC_GENRES.length })}
        </p>
      </div>
    </section>
  );
}
