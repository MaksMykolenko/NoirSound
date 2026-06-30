import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { getTracks, getArtistsWithTracks } from '../api';
import HomeHero from '../components/home/HomeHero';
import BrowseByGenre from '../components/home/BrowseByGenre';
import CreatorCallout from '../components/home/CreatorCallout';
import ProductFeatures from '../components/home/ProductFeatures';
import PageMeta from '../components/meta/PageMeta';
import TrackCard from '../components/tracks/TrackCard';
import ArtistCard from '../components/artists/ArtistCard';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import { usePlayerStore } from '../store/playerStore';
import { useUserStore } from '../store/userStore';
import {
  rankRecommendedArtists,
  sortTracksNewest,
} from '../utils/presentation';

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [trendingTracks, setTrendingTracks] = useState([]);
  const [featuredArtists, setFeaturedArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allTracksContext, setAllTracksContext] = useState([]);
  const { recentlyPlayed, loadRecentlyPlayed } = usePlayerStore();
  const { user, authHydrated } = useUserStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tracksData, artistsData] = await Promise.all([getTracks(), getArtistsWithTracks()]);
        const uniqueTracks = sortTracksNewest(tracksData);
        setAllTracksContext(uniqueTracks);
        setTrendingTracks(uniqueTracks.slice(0, 4));
        setFeaturedArtists(rankRecommendedArtists(artistsData, uniqueTracks).slice(0, 4));
      } catch (err) {
        console.error('Failed to fetch home data:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!authHydrated || !user) return;
    loadRecentlyPlayed().catch(() => {
      // The player store keeps the real API error. Home simply omits this optional section.
    });
  }, [authHydrated, loadRecentlyPlayed, user]);

  const handleGenreSelect = ({ kind, value }) => {
    if (kind === 'more') {
      navigate('/discover?browse=all');
      return;
    }
    navigate(`/discover?${kind}=${encodeURIComponent(value)}`);
  };

  return (
    <div className="flex flex-col gap-8 sm:gap-10 animate-fade-in">
      <PageMeta
        title="NoirSound — Creator-first music platform"
        description="Discover independent music, upload your own tracks, and build your audience on NoirSound."
        canonical="https://noirsound.co/"
      />
      <HomeHero
        onDiscover={() => navigate('/discover')}
        onUpload={() => navigate('/upload')}
      />

      <BrowseByGenre onSelect={handleGenreSelect} />

      <section data-testid="home-releases" className="space-y-4">
        <div className="flex justify-between items-end gap-4 border-b border-zinc-900 pb-3">
          <div className="min-w-0">
            <h2 className="ns-section-title">{t('home.featuredReleases')}</h2>
            <p className="text-sm text-zinc-400 mt-1">{t('home.latestReleasesDesc')}</p>
          </div>
          <button
            onClick={() => navigate('/discover')}
            className="text-xs text-brand-red font-bold hover:underline flex items-center space-x-1 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span>{t('home.exploreAll')}</span>
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {error ? (
            <div className="col-span-full"><ErrorState message={t('home.loadError')} /></div>
          ) : loading ? (
            <div className="col-span-full"><LoadingState count={4} /></div>
          ) : trendingTracks.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                iconName="Music2"
                title={t('empty.noReleasesYet')}
                description={t('home.emptyCatalogueDesc')}
                actionText={t('actions.uploadTrack')}
                onAction={() => navigate('/upload')}
                secondaryActionText={t('actions.discoverGenres')}
                onSecondaryAction={() => navigate('/discover?browse=all')}
                className="!max-w-none !my-0"
              />
            </div>
          ) : (
            trendingTracks.map((track) => (
              <TrackCard key={track.id} track={track} tracksContext={allTracksContext} />
            ))
          )}
        </div>
      </section>

      {recentlyPlayed.length > 0 && (
        <section data-testid="home-continue-listening" className="space-y-4">
          <div className="border-b border-zinc-900 pb-3">
            <h2 className="ns-section-title">{t('home.continueListening')}</h2>
            <p className="text-sm text-zinc-400 mt-1">{t('home.continueListeningDesc')}</p>
          </div>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {recentlyPlayed.slice(0, 4).map((track) => (
              <TrackCard key={track.id} track={track} tracksContext={recentlyPlayed} />
            ))}
          </div>
        </section>
      )}

      <CreatorCallout onUpload={() => navigate('/upload')} />

      <ProductFeatures />

      {!loading && !error && trendingTracks.length > 0 && featuredArtists.length > 0 && (
        <section className="space-y-4">
          <div className="border-b border-zinc-900 pb-3">
            <h2 className="ns-section-title">{t('home.featuredArtists')}</h2>
            <p className="text-sm text-zinc-400 mt-1">{t('home.featuredArtistsDesc')}</p>
          </div>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {featuredArtists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      <div data-testid="home-bottom-safe-area" className="h-px w-full" aria-hidden="true" />
    </div>
  );
}
