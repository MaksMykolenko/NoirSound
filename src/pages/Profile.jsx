import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getFollowedArtists,
  getMyPlaylists,
} from '../api';
import { isMockMode } from '../api/mode';
import { useUserStore } from '../store/userStore';
import ArtistCard from '../components/artists/ArtistCard';
import PlaylistCard from '../components/playlists/PlaylistCard';
import ListeningStats from '../components/profile/ListeningStats';
import UserActivityItem from '../components/profile/UserActivityItem';
import UserProfileHeader, { UserProfileHeaderSkeleton } from '../components/profile/UserProfileHeader';
import UserSettingsForm from '../components/profile/UserSettingsForm';
import TrackListItem from '../components/tracks/TrackListItem';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import PageMeta from '../components/meta/PageMeta';
import useLikedCollection from '../hooks/useLikedCollection';

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [playlists, setPlaylists] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState(null);
  const [playlistRevision, setPlaylistRevision] = useState(0);

  const requestedTab = searchParams.get('tab');
  const activeTab = ['overview', 'liked', 'playlists', 'artists', 'stats', 'activity', 'settings'].includes(requestedTab) ? requestedTab : 'overview';
  const { tracks: likedTracks, loading: likesLoading, error: likesError } = useLikedCollection(playlistRevision);
  const demoMode = isMockMode();

  const {
    user,
    authHydrated,
    authError,
    activity,
    setAuthModalOpen,
  } = useUserStore();

  useEffect(() => {
    const refresh = () => setPlaylistRevision((current) => current + 1);
    window.addEventListener('noirsound:playlists-changed', refresh);
    return () => window.removeEventListener('noirsound:playlists-changed', refresh);
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      document.querySelector('.ns-main-scroll')?.scrollTo?.({ top: 0, behavior: 'auto' });
    }
  }, [activeTab]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    setCollectionsLoading(true);
    setCollectionsError(null);
    Promise.all([getMyPlaylists(), getFollowedArtists()])
      .then(([myPlaylists, artists]) => {
        if (!active) return;
        setPlaylists(myPlaylists);
        setFollowedArtists(artists);
      })
      .catch((requestError) => { if (active) setCollectionsError(requestError); })
      .finally(() => { if (active) setCollectionsLoading(false); });
    return () => { active = false; };
  }, [playlistRevision, user?.id]);

  const headerStats = {
    likedCount: likedTracks.length,
    playlistsCount: playlists.length,
    followingCount: followedArtists.length,
  };

  const pageMeta = (
    <PageMeta
      title={`${user?.displayName || user?.username || t('nav.profile')} · NoirSound`}
      description={user?.bio || t('profile.noBio')}
      canonical="https://noirsound.co/profile"
    />
  );

  if (!authHydrated) {
    return <>{pageMeta}<UserProfileHeaderSkeleton label={t('profile.loadingPublicProfile')} /></>;
  }
  if (authError) return <>{pageMeta}<ErrorState title="Session unavailable" message={authError} /></>;
  if (!user) {
    return (
      <>
        {pageMeta}
        <EmptyState
          iconName="UserRound"
          title={t('empty.signInTitle')}
          description={t('empty.signInDesc')}
          actionText={t('header.signIn')}
          onAction={() => setAuthModalOpen(true)}
        />
      </>
    );
  }

  const navigateToView = (tabKey) => {
    document.querySelector('.ns-main-scroll')?.scrollTo?.({ top: 0, behavior: 'auto' });
    if (!tabKey || tabKey === 'overview') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('tab');
      setSearchParams(nextParams);
    } else {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', tabKey);
      setSearchParams(nextParams);
    }
  };

  return (
    <div className="flex flex-col pb-12">
      {pageMeta}
      {activeTab !== 'settings' && (
        <UserProfileHeader
          user={user}
          viewerUserId={user.id}
          shareUrl={`https://noirsound.co/profile/${encodeURIComponent(user.username)}`}
          onEditClick={() => navigateToView('settings')}
          onSettingsClick={() => navigateToView('settings')}
          stats={headerStats}
        />
      )}

      {/* Subview back banner for collections & stats */}
      {activeTab !== 'overview' && activeTab !== 'settings' && (
        <div className="mt-4 flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <button
            type="button"
            onClick={() => navigateToView('overview')}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white cursor-pointer group"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            <span>{t('profile.overview', 'Overview')}</span>
          </button>

          <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            {activeTab === 'liked'
              ? t('profile.likedTracks')
              : activeTab === 'playlists'
                ? t('profile.playlists')
                : activeTab === 'artists'
                  ? t('profile.followedArtists')
                  : activeTab === 'stats'
                    ? t('profile.stats')
                    : activeTab === 'activity'
                      ? t('profile.activity')
                      : ''}
          </span>
        </div>
      )}

      <div
        data-testid="profile-tab-content"
        id="profile-tab-panel"
        role="region"
        className={activeTab === 'settings' ? 'pt-6 xl:pt-4' : 'pt-5 xl:pt-4'}
      >
        {activeTab === 'overview' && (
          collectionsLoading || likesLoading ? <LoadingState type="list" count={4} />
          : collectionsError || likesError ? <ErrorState title={t('media.libraryUnavailable')} message={collectionsError?.message || likesError} onRetry={() => setPlaylistRevision(value => value + 1)} />
          : <div className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="ns-section-title">{t('profile.likedTracks')}</h2>
                  <button type="button" onClick={() => navigateToView('liked')} className="min-h-11 text-sm text-zinc-400 hover:text-zinc-100">{t('profile.viewAll')}</button>
                </div>
                {likedTracks.length > 0 ? (
                  <div className="ns-track-list">
                    {likedTracks.slice(0, 5).map((track, index) => <TrackListItem key={track.id} track={track} index={index} tracksContext={likedTracks} />)}
                  </div>
                ) : <EmptyState iconName="Heart" title={t('empty.noLikedSongs')} actionText={t('actions.discoverMusic')} onAction={() => navigate('/discover')} />}
              </section>
              {playlists.length > 0 && <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="ns-section-title">{t('profile.playlists')}</h2>
                  <button type="button" onClick={() => navigateToView('playlists')} className="min-h-11 text-sm text-zinc-400 hover:text-zinc-100">{t('profile.viewAll')}</button>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {playlists.slice(0, 4).map(playlist => <PlaylistCard key={playlist.id} playlist={playlist} />)}
                </div>
              </section>}
              {followedArtists.length > 0 && <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="ns-section-title">{t('profile.followedArtists')}</h2>
                  <button type="button" onClick={() => navigateToView('artists')} className="min-h-11 text-sm text-zinc-400 hover:text-zinc-100">{t('profile.viewAll')}</button>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {followedArtists.slice(0, 4).map(artist => <ArtistCard key={artist.id} artist={artist} />)}
                </div>
              </section>}
              <div className="flex flex-wrap gap-5 border-t border-zinc-800 pt-3">
                <button type="button" onClick={() => navigateToView('stats')} className="min-h-11 text-sm text-zinc-400 hover:text-zinc-100">{t('profile.stats')}</button>
                <button type="button" onClick={() => navigateToView('activity')} className="min-h-11 text-sm text-zinc-400 hover:text-zinc-100">{t('profile.activity')}</button>
              </div>
            </div>
        )}

        {activeTab === 'stats' && <ListeningStats />}

        {/* Keep settings form mounted so state is never lost */}
        <div
          data-testid="profile-settings-layout"
          aria-hidden={activeTab !== 'settings'}
          className={`${activeTab === 'settings' ? 'block animate-in fade-in slide-in-from-bottom-2 duration-300' : 'hidden'} w-full space-y-6`}
        >
          {activeTab === 'settings' && (
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="ns-page-title">{t('header.profileSettings')}</h1>
              <button type="button" onClick={() => navigateToView('overview')} className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100">
                <ArrowLeft size={16} />{t('profile.backToProfile')}
              </button>
            </header>
          )}

          <div className="ns-layout-page ns-layout-page--form w-full grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-12">
              <UserSettingsForm />
            </div>
          </div>
        </div>

        {activeTab === 'activity' && (
          demoMode && activity.length > 0 ? (
            <div className="mx-auto max-w-5xl space-y-4">
              {activity.map((item) => <UserActivityItem key={item.id} item={item} />)}
            </div>
          ) : (
            <EmptyState
              iconName="Activity"
              title={t('profile.noActivity')}
              description={t('profile.noActivityDesc')}
            />
          )
        )}

        {activeTab === 'liked' && (
          likesLoading ? (
            <LoadingState type="list" count={3} />
          ) : collectionsError ? (
            <ErrorState
              title="Collection unavailable"
              message={collectionsError.message || t('errors.generic')}
              onRetry={() => setPlaylistRevision((current) => current + 1)}
            />
          ) : likesError ? (
            <ErrorState title={t('media.libraryUnavailable')} message={likesError} onRetry={() => setPlaylistRevision(value => value + 1)} />
          ) : likedTracks.length === 0 ? (
            <EmptyState
              iconName="Heart"
              title={t('empty.noLikedSongs')}
              description={t('profile.likeTracksDesc')}
              actionText={t('actions.discoverMusic')}
              onAction={() => navigate('/discover')}
            />
          ) : (
            <div className="space-y-1">
              {likedTracks.map((track, index) => (
                <TrackListItem key={track.id} track={track} index={index} tracksContext={likedTracks} />
              ))}
            </div>
          )
        )}

        {activeTab === 'playlists' && (
          collectionsLoading ? (
            <LoadingState count={3} />
          ) : collectionsError ? (
            <ErrorState
              title="Collection unavailable"
              message={collectionsError.message || t('errors.generic')}
              onRetry={() => setPlaylistRevision((current) => current + 1)}
            />
          ) : playlists.length === 0 ? (
            <EmptyState
              iconName="ListMusic"
              title={t('profile.noPersonalPlaylists')}
              description={t('profile.createPlaylistsDesc')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 min-[1440px]:grid-cols-5 min-[1800px]:grid-cols-6">
              {playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
            </div>
          )
        )}

        {activeTab === 'artists' && (
          collectionsLoading ? (
            <LoadingState count={3} />
          ) : collectionsError ? (
            <ErrorState
              title="Collection unavailable"
              message={collectionsError.message || t('errors.generic')}
              onRetry={() => setPlaylistRevision((current) => current + 1)}
            />
          ) : followedArtists.length === 0 ? (
            <EmptyState
              iconName="UserCheck"
              title={t('empty.noFollowedArtists')}
              description={t('profile.followArtistsDesc')}
              actionText={t('actions.discoverMusic')}
              onAction={() => navigate('/discover')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 min-[1440px]:grid-cols-5 min-[1800px]:grid-cols-6">
              {followedArtists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
            </div>
          )
        )}
      </div>
    </div>
  );
}
