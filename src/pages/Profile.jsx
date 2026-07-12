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
    Promise.all([getLikedTracks(), getMyPlaylists(), getFollowedArtists()])
      .then(([liked, myPlaylists, artists]) => {
        setLikedTracks(liked);
        setPlaylists(myPlaylists);
        setFollowedArtists(artists);
      })
      .catch(() => {})
      .finally(() => setCollectionsLoading(false));
  }, [demoMode, fetchListeningStats, loadRecentlyPlayed, playlistRevision, user]);

  if (!authHydrated) return <LoadingState type="list" count={4} />;
  if (authError) return <ErrorState title="Session unavailable" message={authError} />;
  if (!user) {
    return (
      <EmptyState
        iconName="UserRound"
        title={t('empty.signInTitle')}
        description={t('empty.signInDesc')}
        actionText={t('header.signIn')}
        onAction={() => setAuthModalOpen(true)}
      />
    );
  }

  return (
    <div className="ns-page-stack pb-10">
      <UserProfileHeader user={user} onEditClick={() => setSearchParams({ tab: 'settings' })} />

      <div className="ns-tabs-scroll flex border-b border-zinc-800/60 gap-1 overflow-x-auto shrink-0" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ tab: tab.id })}
              role="tab"
              aria-selected={active}
              className={`ns-tab flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 font-mono text-[9px] font-medium uppercase tracking-wider transition-colors sm:gap-2 sm:px-5 sm:py-3 sm:text-[10px] ${
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

      <div className="pt-2">
        {activeTab === 'overview' && (
          <section className="mx-auto max-w-3xl space-y-4">
            <h2 className="ns-eyebrow px-1">{t('nav.recentlyPlayed')}</h2>
            {recentlyPlayedError ? (
              <ErrorState title="Listening history unavailable" message={recentlyPlayedError} />
            ) : recentlyPlayed.length === 0 ? (
              <EmptyState
                iconName="History"
                title={t('empty.nothingPlayed')}
                description={t('empty.nothingPlayedDesc')}
                actionText={t('actions.discoverMusic')}
                onAction={() => navigate('/discover')}
              />
            ) : (
              <div className="space-y-1 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-2 sm:p-3">
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
        
        {activeTab === 'settings' && (
          <div className="mx-auto max-w-2xl rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-4 sm:p-5">
            <UserSettingsForm />
          </div>
        )}

        {activeTab === 'activity' && (
          demoMode && activity.length > 0 ? (
            <div className="max-w-xl mx-auto space-y-4">
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
          ) : likedTracks.length === 0 ? (
            <EmptyState
              iconName="Heart"
              title={t('empty.noLikedSongs')}
              description={t('profile.likeTracksDesc')}
              actionText={t('actions.discoverMusic')}
              onAction={() => navigate('/discover')}
            />
          ) : (
            <div className="space-y-1 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-2 sm:p-3">
              {likedTracks.map((track, index) => (
                <TrackListItem key={track.id} track={track} index={index} tracksContext={likedTracks} />
              ))}
            </div>
          )
        )}

        {activeTab === 'playlists' && (
          collectionsLoading ? (
            <LoadingState type="list" count={3} />
          ) : playlists.length === 0 ? (
            <EmptyState
              iconName="ListMusic"
              title={t('profile.noPersonalPlaylists')}
              description={t('profile.createPlaylistsDesc')}
            />
          ) : (
            <div className="grid grid-cols-1 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
            </div>
          )
        )}

        {activeTab === 'artists' && (
          collectionsLoading ? (
            <LoadingState type="list" count={3} />
          ) : followedArtists.length === 0 ? (
            <EmptyState
              iconName="UserCheck"
              title={t('empty.noFollowedArtists')}
              description={t('profile.followArtistsDesc')}
              actionText={t('actions.discoverMusic')}
              onAction={() => navigate('/discover')}
            />
          ) : (
            <div className="grid grid-cols-1 min-[430px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {followedArtists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
            </div>
          )
        )}
      </div>
    </div>
  );
}
