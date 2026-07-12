import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { getTracks, getArtistsWithTracks } from '../api';
import HomeHero from '../components/home/HomeHero';
import BrowseByGenre from '../components/home/BrowseByGenre';
import CreatorCallout from '../components/home/CreatorCallout';
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
  const [homeRevision, setHomeRevision] = useState(0);
  const [allTracksContext, setAllTracksContext] = useState([]);
  const { recentlyPlayed, loadRecentlyPlayed } = usePlayerStore();
  const { user, authHydrated } = useUserStore();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
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
  }, [homeRevision]);

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
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageMeta
        title="NoirSound — Creator-first music platform"
        description="Discover independent music, upload your own tracks, and build your audience on NoirSound."
        canonical="https://noirsound.co/"
      />
      <HomeHero
        onDiscover={() => navigate('/discover')}
        onUpload={() => navigate('/upload')}
      />

      {recentlyPlayed.length > 0 && (
        <section data-testid="home-continue-listening" className="space-y-4">
          <div>
            <h2 className="ns-section-title">{t('home.continueListening')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('home.continueListeningDesc')}</p>
          </div>
          <div className="ns-tabs-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 min-[480px]:mx-0 min-[480px]:grid min-[480px]:grid-cols-2 min-[480px]:px-0 md:grid-cols-3 xl:grid-cols-4 sm:gap-5">
            {recentlyPlayed.slice(0, 4).map((track) => (
              <div key={track.id} className="w-[min(74vw,18rem)] shrink-0 min-[480px]:w-auto">
                <TrackCard track={track} tracksContext={recentlyPlayed} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section data-testid="home-releases" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="ns-section-title">{t('home.featuredReleases')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('home.latestReleasesDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/discover')}
            className="flex shrink-0 cursor-pointer items-center space-x-1 whitespace-nowrap font-sans text-ns-meta font-medium text-brand-red hover:underline"
          >
            <span>{t('home.exploreAll')}</span>
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
        <div className="ns-tabs-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 min-[480px]:mx-0 min-[480px]:grid min-[480px]:grid-cols-2 min-[480px]:px-0 md:grid-cols-3 xl:grid-cols-4 sm:gap-5">
          {error ? (
            <div className="w-full min-[480px]:col-span-full">
              <ErrorState
                message={t('home.loadError')}
                onRetry={() => setHomeRevision((current) => current + 1)}
              />
            </div>
          ) : loading ? (
            <div className="w-full min-[480px]:col-span-full"><LoadingState count={4} /></div>
          ) : trendingTracks.length === 0 ? (
            <div className="w-full min-[480px]:col-span-full">
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
              <div key={track.id} className="w-[min(74vw,18rem)] shrink-0 min-[480px]:w-auto">
                <TrackCard track={track} tracksContext={allTracksContext} />
              </div>
            ))
          )}
        </div>
      </section>

      {!loading && !error && trendingTracks.length > 0 && featuredArtists.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="ns-section-title">{t('home.featuredArtists')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('home.featuredArtistsDesc')}</p>
          </div>
          <div className="ns-tabs-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 min-[480px]:mx-0 min-[480px]:grid min-[480px]:grid-cols-2 min-[480px]:px-0 md:grid-cols-3 xl:grid-cols-4 sm:gap-5">
            {featuredArtists.map((artist) => (
              <div key={artist.id} className="w-[min(66vw,15rem)] shrink-0 min-[480px]:w-auto">
                <ArtistCard artist={artist} />
              </div>
            ))}
          </div>
        </section>
      )}

      <BrowseByGenre onSelect={handleGenreSelect} />

      <CreatorCallout onUpload={() => navigate('/upload')} />

      <div data-testid="home-bottom-safe-area" className="h-px w-full" aria-hidden="true" />
    </div>
  );
}
