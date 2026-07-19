import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  BarChart3,
  Heart,
  ListMusic,
  Settings,
  User,
  UserCheck,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getFollowedArtists,
  getLikedTracks,
  getMyPlaylists,
} from '../api';
import { isMockMode } from '../api/mode';
import { usePlayerStore } from '../store/playerStore';
import { useUserStore } from '../store/userStore';
import ArtistCard from '../components/artists/ArtistCard';
import PlaylistCard from '../components/playlists/PlaylistCard';
import ListeningStats from '../components/profile/ListeningStats';
import UserActivityItem from '../components/profile/UserActivityItem';
import UserProfileHeader from '../components/profile/UserProfileHeader';
import UserSettingsForm from '../components/profile/UserSettingsForm';
import TrackListItem from '../components/tracks/TrackListItem';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import PageMeta from '../components/meta/PageMeta';
import useScrollableTabs from '../hooks/useScrollableTabs';

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabs = [
    { id: 'overview', label: t('profile.overview'), mobileLabel: t('profile.overview'), icon: User },
    { id: 'liked', label: t('profile.likedTracks'), mobileLabel: t('profile.likedTracks'), icon: Heart },
    { id: 'playlists', label: t('profile.playlists'), mobileLabel: t('profile.playlists'), icon: ListMusic },
    { id: 'artists', label: t('profile.followedArtists'), mobileLabel: t('profile.followedArtists'), icon: UserCheck },
    { id: 'activity', label: t('profile.activity'), mobileLabel: t('profile.activity'), icon: Activity },
    { id: 'stats', label: t('profile.stats'), mobileLabel: t('profile.stats'), icon: BarChart3 },
    { id: 'settings', label: t('profile.settings'), mobileLabel: t('profile.settings'), icon: Settings },
  ];

  const activeTab = tabs.some((tab) => tab.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';
  const tabsRef = useScrollableTabs(activeTab);
  const demoMode = isMockMode();

  const {
    user,
    authHydrated,
    authError,
    activity,
    setAuthModalOpen,
    fetchListeningStats,
  } = useUserStore();
  const {
    recentlyPlayed,
    recentlyPlayedError,
    loadRecentlyPlayed,
  } = usePlayerStore();

  const [likedTracks, setLikedTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState(null);
  const [playlistRevision, setPlaylistRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setPlaylistRevision((current) => current + 1);
    window.addEventListener('noirsound:playlists-changed', refresh);
    return () => window.removeEventListener('noirsound:playlists-changed', refresh);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchListeningStats().catch(() => {});
    loadRecentlyPlayed().catch(() => {});

    setCollectionsLoading(true);
    setCollectionsError(null);
    Promise.all([getLikedTracks(), getMyPlaylists(), getFollowedArtists()])
      .then(([liked, myPlaylists, artists]) => {
        setLikedTracks(liked);
        setPlaylists(myPlaylists);
        setFollowedArtists(artists);
      })
      .catch((requestError) => setCollectionsError(requestError))
      .finally(() => setCollectionsLoading(false));
  }, [demoMode, fetchListeningStats, loadRecentlyPlayed, playlistRevision, user]);

  const pageMeta = (
    <PageMeta
      title={`${user?.displayName || user?.username || t('nav.profile')} · NoirSound`}
      description={user?.bio || t('profile.noBio')}
      canonical="https://noirsound.co/profile"
    />
  );

  if (!authHydrated) return <>{pageMeta}<LoadingState type="list" count={4} /></>;
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

  return (
    <div className={activeTab === 'settings' ? 'flex flex-col pb-10' : 'ns-page-stack pb-10'}>
      {pageMeta}
      <UserProfileHeader
        user={user}
        viewerUserId={user.id}
        shareUrl={`https://noirsound.co/profile/${encodeURIComponent(user.username)}`}
        onEditClick={() => setSearchParams({ tab: 'settings' })}
      />

      <div
        ref={tabsRef}
        data-testid="profile-tabs"
        className={`ns-tabs-scroll ns-tabs-polish sticky top-0 z-10 flex shrink-0 scroll-mt-2 gap-1 overflow-x-auto border-b border-zinc-800/60 bg-[var(--ns-bg)] ${activeTab === 'settings' ? 'mt-5' : ''}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ tab: tab.id })}
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              className={`ns-tab flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 font-sans text-ns-label font-medium transition-colors sm:gap-2 sm:px-5 sm:py-3 ${tab.id === 'settings' ? 'ml-2 sm:ml-auto' : ''} ${
                active ? 'border-brand-red text-rose-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="inline sm:hidden">{tab.mobileLabel}</span>
            </button>
          );
        })}
      </div>

      <div className={activeTab === 'settings' ? 'pt-6' : 'pt-2'}>
        {activeTab === 'overview' && (
          <section className="space-y-4">
            <h2 className="ns-eyebrow px-1">{t('nav.recentlyPlayed')}</h2>
            {recentlyPlayedError ? (
              <ErrorState
                title="Listening history unavailable"
                message={recentlyPlayedError}
                onRetry={() => loadRecentlyPlayed()}
              />
            ) : recentlyPlayed.length === 0 ? (
              <EmptyState
                iconName="History"
                title={t('empty.nothingPlayed')}
                description={t('empty.nothingPlayedDesc')}
                actionText={t('actions.discoverMusic')}
                onAction={() => navigate('/discover')}
              />
            ) : (
              <div className="space-y-1">
                {recentlyPlayed.slice(0, 5).map((track, index) => (
                  <TrackListItem
                    key={track.id}
                    track={track}
                    index={index}
                    tracksContext={recentlyPlayed}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'stats' && <ListeningStats />}
        
        {/* Keep the settings form mounted while moving between profile tabs so
            an unsaved bio or selected local banner is never silently dropped. */}
        <div
          data-testid="profile-settings-layout"
          aria-hidden={activeTab !== 'settings'}
          className={`${activeTab === 'settings' ? 'grid' : 'hidden'} ns-layout-page ns-layout-page--form w-full grid-cols-1 gap-6 xl:grid-cols-12`}
        >
          <div className="min-w-0 xl:col-span-12 2xl:col-span-9">
            <UserSettingsForm />
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
          collectionsLoading ? (
            <LoadingState type="list" count={3} />
          ) : collectionsError ? (
            <ErrorState
              title="Collection unavailable"
              message={collectionsError.message || t('errors.generic')}
              onRetry={() => setPlaylistRevision((current) => current + 1)}
            />
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
