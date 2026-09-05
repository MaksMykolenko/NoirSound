import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { getCatalogTracks, getArtistsWithTracks } from '../api';
import HomeHero from '../components/home/HomeHero';
import BrowseByGenre from '../components/home/BrowseByGenre';
import CreatorCallout from '../components/home/CreatorCallout';
import BeatsInfoCard from '../components/home/BeatsInfoCard';
import PageMeta from '../components/meta/PageMeta';
import TrackCard from '../components/tracks/TrackCard';
import ArtistCard from '../components/artists/ArtistCard';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import { usePlayerStore } from '../store/playerStore';
import { useUserStore } from '../store/userStore';

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [newMusicTracks, setNewMusicTracks] = useState([]);
  const [freshBeats, setFreshBeats] = useState([]);
  const [featuredArtists, setFeaturedArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [homeRevision, setHomeRevision] = useState(0);
  const [allTracksContext, setAllTracksContext] = useState([]);
  const { recentlyPlayed, loadRecentlyPlayed } = usePlayerStore();
  const { user, authHydrated } = useUserStore();

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [musicPage, beatPage, artistsData] = await Promise.all([
          getCatalogTracks({ contentType: 'MUSIC', sort: 'recent', limit: 8 }, { signal: controller.signal }),
          getCatalogTracks({ contentType: 'BEAT', sort: 'recent', limit: 8 }, { signal: controller.signal }),
          getArtistsWithTracks({ sort: 'trending', limit: 8 }, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        // These are bounded editorial selections; the server determines type and order.
        setAllTracksContext(musicPage.items);
        setNewMusicTracks(musicPage.items);
        setFreshBeats(beatPage.items);
        setFeaturedArtists(artistsData);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch home data:', err);
        setError(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [homeRevision, user?.id]);

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
          <div
            data-testid="home-continue-grid"
            className="ns-tabs-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:[grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))] sm:gap-5 sm:px-0"
          >
            {recentlyPlayed.slice(0, 8).map((track) => (
              <div key={track.id} className="w-[min(74vw,18rem)] shrink-0 sm:w-full sm:max-w-[17.5rem] sm:justify-self-start">
                <TrackCard track={track} tracksContext={recentlyPlayed} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section data-testid="home-releases" className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <div className="min-w-0">
            <h2 className="ns-section-title">{t('home.newMusic')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('home.newMusicDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/discover?content=MUSIC&sort=recent#discover-catalog')}
            className="flex shrink-0 cursor-pointer items-center space-x-1 whitespace-nowrap font-sans text-ns-meta font-medium text-brand-red hover:underline"
          >
            <span>{t('home.exploreAll')}</span>
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
        <div
          data-testid="home-release-grid"
          className="ns-tabs-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:[grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))] sm:gap-5 sm:px-0"
        >
          {error ? (
            <div className="w-full min-w-full shrink-0 sm:col-span-full sm:min-w-0">
              <ErrorState
                message={t('home.loadError')}
                onRetry={() => setHomeRevision((current) => current + 1)}
              />
            </div>
          ) : loading ? (
            <div className="w-full min-w-full shrink-0 sm:col-span-full sm:min-w-0"><LoadingState count={4} /></div>
          ) : newMusicTracks.length === 0 ? (
            <div className="w-full min-w-full shrink-0 sm:col-span-full sm:min-w-0">
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
            newMusicTracks.map((track) => (
              <div key={track.id} className="w-[min(74vw,18rem)] shrink-0 sm:w-full sm:max-w-[17.5rem] sm:justify-self-start">
                <TrackCard track={track} tracksContext={allTracksContext} />
              </div>
            ))
          )}
        </div>
      </section>

      <section data-testid="home-fresh-beats" className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <div className="min-w-0">
            <h2 className="ns-section-title">{t('beats.freshBeats')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('home.freshBeatsDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/discover?content=BEAT&sort=recent#discover-catalog')}
            className="flex shrink-0 cursor-pointer items-center space-x-1 whitespace-nowrap font-sans text-ns-meta font-medium text-brand-red hover:underline"
          >
            <span>{t('home.exploreAll')}</span>
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
        <div className="ns-tabs-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:[grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))] sm:gap-5 sm:px-0">
          {error ? (
            <div className="w-full min-w-full shrink-0 sm:col-span-full sm:min-w-0">
              <ErrorState message={t('home.loadError')} onRetry={() => setHomeRevision((current) => current + 1)} />
            </div>
          ) : loading ? (
            <div className="w-full min-w-full shrink-0 sm:col-span-full sm:min-w-0"><LoadingState count={4} /></div>
          ) : freshBeats.length === 0 ? (
            <div className="w-full min-w-full shrink-0 sm:col-span-full sm:min-w-0">
              <EmptyState
                iconName="AudioLines"
                title={t('beats.noBeats')}
                description={t('beats.noBeatsDescription')}
                actionText={t('content.uploadBeat')}
                onAction={() => navigate('/upload')}
                className="!my-0 !max-w-none"
              />
            </div>
          ) : (
            freshBeats.map((track) => (
              <div key={track.id} className="w-[min(74vw,18rem)] shrink-0 sm:w-full sm:max-w-[17.5rem] sm:justify-self-start">
                <TrackCard track={track} tracksContext={freshBeats} />
              </div>
            ))
          )}
        </div>
      </section>

      <BeatsInfoCard />

      {!loading && !error && newMusicTracks.length > 0 && featuredArtists.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="ns-section-title">{t('home.featuredArtists')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('home.featuredArtistsDesc')}</p>
          </div>
          <div
            data-testid="home-artist-grid"
            className="ns-tabs-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:[grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))] sm:gap-5 sm:px-0"
          >
            {featuredArtists.map((artist) => (
              <div key={artist.id} className="w-[min(66vw,15rem)] shrink-0 sm:w-full sm:max-w-[15rem] sm:justify-self-start">
                <ArtistCard artist={artist} metric="followers" />
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
