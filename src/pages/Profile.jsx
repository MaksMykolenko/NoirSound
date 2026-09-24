import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Heart,
  ListMusic,
  Settings,
  UserCheck,
  Play,
  ArrowRight,
  ArrowLeft,
  Clock,
  Disc,
  Flame,
  Compass,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getFollowedArtists,
  getMyPlaylists,
} from '../api';
import { isMockMode } from '../api/mode';
import { usePlayerStore } from '../store/playerStore';
import { useUserStore } from '../store/userStore';
import ArtistCard from '../components/artists/ArtistCard';
import PlaylistCard from '../components/playlists/PlaylistCard';
import ListeningStats from '../components/profile/ListeningStats';
import UserActivityItem from '../components/profile/UserActivityItem';
import UserProfileHeader, { UserProfileHeaderSkeleton } from '../components/profile/UserProfileHeader';
import UserSettingsForm from '../components/profile/UserSettingsForm';
import SoundIdentityCard from '../components/profile/SoundIdentityCard';
import TrackListItem from '../components/tracks/TrackListItem';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import FallbackCover from '../components/ui/FallbackCover';
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
    fetchListeningStats,
    userListeningStats,
    listeningStatsHydrated,
    listeningStatsError,
  } = useUserStore();
  const {
    recentlyPlayed,
    recentlyPlayedError,
    loadRecentlyPlayed,
    playTrack,
  } = usePlayerStore();

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
    fetchListeningStats().catch(() => {});
    loadRecentlyPlayed().catch(() => {});

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
  }, [demoMode, fetchListeningStats, loadRecentlyPlayed, playlistRevision, user?.id]);

  const stats = userListeningStats || {};
  const measuredSeconds = Number(
    stats.totalListeningSeconds ?? (stats.totalListeningMinutes || 0) * 60
  );
  const listeningTimeLabel = measuredSeconds <= 0
    ? null
    : measuredSeconds < 60
      ? `${measuredSeconds}s`
      : measuredSeconds < 3600
        ? `${Math.floor(measuredSeconds / 60)}m`
        : `${Math.floor(measuredSeconds / 3600)}h ${Math.floor((measuredSeconds % 3600) / 60)}m`;

  const headerStats = {
    likedCount: likedTracks.length,
    playlistsCount: playlists.length,
    followingCount: followedArtists.length,
    listeningTime: listeningTimeLabel,
  };

  const isCreator = ['ARTIST', 'ADMIN'].includes(user?.role);
  const artistId = user?.artistProfileId || user?.artistProfile?.id || user?.artistId;

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
          : <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
            {/* Left: Main Musical Stage */}
            <div className="space-y-8 xl:col-span-8">
              {/* Liked Songs Hero Showcase Card */}
              <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-[var(--ns-card-solid)] p-6 group">

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-red/20 text-brand-red">
                        <Heart size={14} fill="currentColor" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
                        {t('profile.likedTracks')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold tracking-tight text-[var(--ns-design-ink)]">
                        {likedTracks.length > 0 ? (
                          <span>{t('redesign.favoriteCount', { count: likedTracks.length })}</span>
                        ) : (
                          <span>{t('redesign.startCollecting')}</span>
                        )}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-400 max-w-md">
                        {likedTracks.length > 0
                          ? t('redesign.savedDescription')
                          : t('profile.likeTracksDesc')}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {likedTracks.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => playTrack(likedTracks[0], likedTracks)}
                            className="inline-flex items-center gap-2 rounded-full bg-brand-red px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-brand-red/90 hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            <Play size={14} fill="currentColor" />
                            <span>{t('redesign.playLiked')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToView('liked')}
                            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white cursor-pointer"
                          >
                            <span>{t('profile.viewAll', 'View All')}</span>
                            <ArrowRight size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate('/discover')}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-red px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-brand-red/90 hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <Compass size={14} />
                          <span>{t('actions.discoverMusic')}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-cover mosaic or stylized vinyl visual */}
                  <div className="relative shrink-0 flex items-center justify-center self-center sm:self-auto">
                    {likedTracks.length >= 3 ? (
                      <div className="relative h-28 w-32 sm:h-32 sm:w-36">
                        <div className="absolute top-0 right-0 h-24 w-24 rounded-lg overflow-hidden border border-zinc-700/60 shadow-md rotate-6 transform translate-x-2">
                          <FallbackCover src={likedTracks[2]?.coverUrl} title={likedTracks[2]?.title} className="h-full w-full object-cover" />
                        </div>
                        <div className="absolute top-2 right-4 h-24 w-24 rounded-lg overflow-hidden border border-zinc-700/80 -rotate-3 transform">
                          <FallbackCover src={likedTracks[1]?.coverUrl} title={likedTracks[1]?.title} className="h-full w-full object-cover" />
                        </div>
                        <div className="absolute top-4 right-8 h-24 w-24 rounded-lg overflow-hidden border border-zinc-600">
                          <FallbackCover src={likedTracks[0]?.coverUrl} title={likedTracks[0]?.title} className="h-full w-full object-cover" />
                        </div>
                      </div>
                    ) : likedTracks.length > 0 ? (
                      <div className="h-28 w-28 rounded-xl overflow-hidden border border-zinc-700">
                        <FallbackCover src={likedTracks[0]?.coverUrl} title={likedTracks[0]?.title} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 text-zinc-600 shadow-inner">
                        <Heart size={36} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recently Played Section */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold tracking-tight text-[var(--ns-design-ink)] flex items-center gap-2">
                    <Clock size={16} className="text-zinc-400" />
                    <span>{t('nav.recentlyPlayed')}</span>
                  </h2>
                  {recentlyPlayed.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/discover')}
                      className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {t('actions.discoverMusic')} →
                    </button>
                  )}
                </div>

                {recentlyPlayedError ? (
                  <ErrorState
                    title="Listening history unavailable"
                    message={recentlyPlayedError}
                    onRetry={() => loadRecentlyPlayed()}
                  />
                ) : recentlyPlayed.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 text-center space-y-2">
                    <p className="text-sm text-zinc-400">{t('empty.nothingPlayed')}</p>
                    <button
                      type="button"
                      onClick={() => navigate('/discover')}
                      className="text-xs font-semibold text-brand-red hover:underline cursor-pointer"
                    >
                      {t('actions.discoverMusic')} →
                    </button>
                  </div>
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

              {/* My Playlists Shelf */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold tracking-tight text-[var(--ns-design-ink)] flex items-center gap-2">
                    <ListMusic size={16} className="text-zinc-400" />
                    <span>{t('profile.playlists')}</span>
                    <span className="text-xs font-normal text-zinc-500">({playlists.length})</span>
                  </h2>
                  {playlists.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigateToView('playlists')}
                      className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {t('profile.viewAll', 'View All')} →
                    </button>
                  )}
                </div>

                {playlists.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-900/20 p-6 text-center space-y-2">
                    <p className="text-sm text-zinc-400">{t('profile.noPersonalPlaylists')}</p>
                    <p className="text-xs text-zinc-500">{t('profile.createPlaylistsDesc')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {playlists.slice(0, 4).map((playlist) => (
                      <PlaylistCard key={playlist.id} playlist={playlist} />
                    ))}
                  </div>
                )}
              </section>

              {/* Followed Artists Shelf */}
              {followedArtists.length > 0 && (
                <section className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold tracking-tight text-[var(--ns-design-ink)] flex items-center gap-2">
                      <UserCheck size={16} className="text-zinc-400" />
                      <span>{t('profile.followedArtists')}</span>
                      <span className="text-xs font-normal text-zinc-500">({followedArtists.length})</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigateToView('artists')}
                      className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {t('profile.viewAll', 'View All')} →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {followedArtists.slice(0, 4).map((artist) => (
                      <ArtistCard key={artist.id} artist={artist} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right: Sound Identity & Stats Sidebar */}
            <div className="space-y-6 xl:col-span-4">
              {/* Sound Identity Card (Compact & Expanded) */}
              {!listeningStatsHydrated ? <LoadingState type="list" count={2} /> : listeningStatsError ? (
                <ErrorState title={t('redesign.statsUnavailable')} message={listeningStatsError} onRetry={() => fetchListeningStats()} />
              ) : <SoundIdentityCard stats={stats} listeningTimeLabel={listeningTimeLabel} onOpenFullStats={() => navigateToView('stats')} />}

              {/* Creator Studio Card / Action Callout */}
              {isCreator ? (
                <div className="rounded-2xl border border-zinc-800/80 bg-[var(--ns-card-solid)] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-purple-300">
                    <Disc size={16} />
                    <h3 className="text-sm font-bold tracking-wide uppercase font-mono">{t('redesign.creatorHub')}</h3>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {t('redesign.creatorDescription')}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => navigate('/upload')}
                      className="flex-1 rounded-lg bg-brand-red px-3 py-2 text-center text-xs font-semibold text-white shadow-md hover:bg-brand-red/90 transition-colors cursor-pointer"
                    >
                      {t('actions.uploadTrack')}
                    </button>
                    {artistId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/artist/${artistId}`)}
                        className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        {t('redesign.artistPage')}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800/80 bg-[var(--ns-card-solid)] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Flame size={16} />
                    <h3 className="text-sm font-bold tracking-wide uppercase font-mono">{t('redesign.shareSound')}</h3>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {t('redesign.shareDescription')}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/upload')}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-center text-xs font-semibold text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer"
                  >
                    {t('redesign.publish')} →
                  </button>
                </div>
              )}
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
            <div className="rounded-2xl border border-zinc-800/80 bg-[var(--ns-card-solid)] p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => navigateToView('overview')}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-800/90 px-4 py-2 text-xs font-semibold text-zinc-100 shadow-md transition-all hover:bg-zinc-700 hover:scale-105 active:scale-95 cursor-pointer group"
                  >
                    <ArrowLeft size={15} className="text-zinc-400 group-hover:text-white transition-colors group-hover:-translate-x-1" />
                    <span>{t('profile.backToProfile', 'Back to Profile')}</span>
                  </button>

                  <div className="h-7 w-px bg-zinc-800 hidden sm:block" />

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red/15 text-brand-red border border-brand-red/30 shadow-inner">
                      <Settings size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--ns-design-ink)] tracking-wide uppercase font-mono">
                        {t('redesign.accountSettings')}
                      </h2>
                      <p className="text-xs text-zinc-400">
                        {t('redesign.editingFor', { username: user.username })}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigateToView('overview')}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <span>{t('redesign.doneEditing')}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
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
