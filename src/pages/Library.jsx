import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, History, ListMusic, Plus, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getArtists,
  getFollowedArtists,
  getLikedTracks,
  getMyPlaylists,
  getTracks,
  createPlaylist,
  setPlaylistSaved,
} from '../api';
import { isMockMode } from '../api/mode';
import { usePlayerStore } from '../store/playerStore';
import { useUserStore } from '../store/userStore';
import ArtistCard from '../components/artists/ArtistCard';
import PlaylistCard from '../components/playlists/PlaylistCard';
import TrackListItem from '../components/tracks/TrackListItem';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import CreatePlaylistModal from '../components/playlists/CreatePlaylistModal';

export default function Library() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');

  const tabs = [
    { id: 'liked', label: t('nav.likedSongs'), icon: Heart },
    { id: 'playlists', label: t('nav.playlists'), icon: ListMusic },
    { id: 'recently', label: t('nav.recentlyPlayed'), icon: History },
    { id: 'artists', label: t('nav.followedArtists'), icon: Users },
  ];

  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'liked';
  const demoMode = isMockMode();

  const { user, authHydrated, setAuthModalOpen } = useUserStore();
  const {
    likedTracks,
    recentlyPlayed,
    recentlyPlayedError,
    loadRecentlyPlayed,
  } = usePlayerStore();

  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [playlistRevision, setPlaylistRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setPlaylistRevision((current) => current + 1);
    window.addEventListener('noirsound:playlists-changed', refresh);
    return () => window.removeEventListener('noirsound:playlists-changed', refresh);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    if (demoMode) {
      Promise.all([getTracks(), getArtists(), getMyPlaylists()])
        .then(([nextTracks, nextArtists, nextPlaylists]) => {
          setTracks(nextTracks);
          setArtists(nextArtists);
          setPlaylists(nextPlaylists);
          setError(null);
        })
        .catch((requestError) => setError(requestError.message))
        .finally(() => setLoading(false));
      return;
    }

    // Real API mode: load user's real collection
    Promise.all([getLikedTracks(), getFollowedArtists(), getMyPlaylists()])
      .then(([realLiked, realArtists, realPlaylists]) => {
        setTracks(realLiked);
        setArtists(realArtists);
        setPlaylists(realPlaylists);
        setError(null);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));

    loadRecentlyPlayed().catch(() => {
      // Player store retains error for recently played tab
    });
  }, [demoMode, loadRecentlyPlayed, playlistRevision, user]);

  const handleCreatePlaylist = async (playlistData) => {
    const created = await createPlaylist(playlistData);
    setPlaylists((current) => [created, ...current]);
    setCreateOpen(false);
    window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
    navigate(`/playlist/${created.id}`);
  };

  const handleToggleSaved = async (playlist) => {
    const nextSaved = !playlist.isSaved;
    await setPlaylistSaved(playlist.id, nextSaved);
    if (nextSaved) {
      setPlaylists((current) => current.map((item) => item.id === playlist.id ? { ...item, isSaved: true } : item));
    } else {
      setPlaylists((current) => current.filter((item) => item.id !== playlist.id || item.isOwner));
    }
    window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
  };

  const likedSongs = useMemo(() => {
    if (demoMode) {
      return tracks.filter((track) => likedTracks.includes(track.id));
    }
    return tracks;
  }, [demoMode, likedTracks, tracks]);

  if (!authHydrated) return <LoadingState type="list" count={4} />;
  if (!user) {
    return (
      <EmptyState
        iconName="Library"
        title={t('empty.signInTitle')}
        description={t('empty.signInDesc')}
        actionText={t('header.signIn')}
        onAction={() => setAuthModalOpen(true)}
      />
    );
  }

  return (
    <div className="ns-page-stack">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="ns-page-title">{t('nav.yourLibrary')}</h1>
          <p className="ns-page-lede">{t('library.subtitle')}</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="ns-button-primary inline-flex min-h-11 shrink-0 items-center gap-2 px-4 text-sm">
          <Plus size={15} /> New playlist
        </button>
      </div>

      <div className="ns-tabs-scroll flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-800/60" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ tab: tab.id })}
              role="tab"
              aria-selected={active}
              className={`ns-tab flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-sans text-ns-label font-medium transition-colors sm:px-5 ${
                active ? 'border-brand-red text-rose-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        {error ? (
          <ErrorState title="Library unavailable" message={error} />
        ) : loading ? (
          <LoadingState type="list" count={4} />
        ) : activeTab === 'recently' ? (
          recentlyPlayedError ? (
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
              {recentlyPlayed.map((track, index) => (
                <TrackListItem key={track.id} track={track} index={index} tracksContext={recentlyPlayed} />
              ))}
            </div>
          )
        ) : activeTab === 'liked' ? (
          likedSongs.length === 0 ? (
            <EmptyState
              iconName="Heart"
              title={t('empty.noLikedSongs')}
              description="Like a track while listening to build your collection."
              actionText={t('actions.discoverMusic')}
              onAction={() => navigate('/discover')}
            />
          ) : (
            <div className="space-y-1 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-2 sm:p-3">
              {likedSongs.map((track, index) => (
                <TrackListItem key={track.id} track={track} index={index} tracksContext={likedSongs} />
              ))}
            </div>
          )
        ) : activeTab === 'playlists' ? (
          playlists.length === 0 ? (
            <EmptyState
              iconName="ListMusic"
              title={t('empty.noPlaylists')}
              description="Create custom playlists to organize your favorite late-night soundscapes."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 min-[1440px]:grid-cols-5 min-[1800px]:grid-cols-6">
              {playlists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  onToggleSaved={!playlist.isOwner ? () => handleToggleSaved(playlist) : undefined}
                />
              ))}
            </div>
          )
        ) : (
          artists.length === 0 ? (
            <EmptyState
              iconName="Users"
              title={t('empty.noFollowedArtists')}
              description="Follow creators from their profile pages to see them here."
              actionText={t('actions.discoverMusic')}
              onAction={() => navigate('/discover')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 min-[1440px]:grid-cols-5 min-[1800px]:grid-cols-6">
              {artists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
            </div>
          )
        )}
      </div>
      <CreatePlaylistModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreatePlaylist} />
    </div>
  );
}
