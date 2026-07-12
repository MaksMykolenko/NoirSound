import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, History, ListMusic, Plus, Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  createPlaylist,
  getArtists,
  getFollowedArtists,
  getLikedTracks,
  getMyPlaylists,
} from '../../api';
import { isMockMode } from '../../api/mode';
import { usePlayerStore } from '../../store/playerStore';
import { useUserStore } from '../../store/userStore';
import SidebarArtistItem from '../artists/SidebarArtistItem';
import CreatePlaylistModal from '../playlists/CreatePlaylistModal';
import SidebarPlaylistItem from '../playlists/SidebarPlaylistItem';

export default function LibrarySidebarSection({ onItemClick }) {
  const navigate = useNavigate();
  const demoMode = isMockMode();
  const { user, setAuthModalOpen } = useUserStore();
  const { likedTracks, recentlyPlayed } = usePlayerStore();
  const [playlists, setPlaylists] = useState([]);
  const [artists, setArtists] = useState([]);
  const [realLikedCount, setRealLikedCount] = useState(0);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playlistRevision, setPlaylistRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setPlaylistRevision((current) => current + 1);
    window.addEventListener('noirsound:playlists-changed', refresh);
    return () => window.removeEventListener('noirsound:playlists-changed', refresh);
  }, []);

  useEffect(() => {
    if (!user) {
      setPlaylists([]);
      setArtists([]);
      setRealLikedCount(0);
      return;
    }
    if (demoMode) {
      Promise.all([getMyPlaylists(), getArtists()])
        .then(([playlistData, artistData]) => {
          setPlaylists(playlistData);
          setArtists(artistData.slice(0, 4));
        })
        .catch(() => {});
      return;
    }

    Promise.all([getMyPlaylists(), getFollowedArtists(), getLikedTracks()])
      .then(([playlistData, artistData, likedData]) => {
        setPlaylists(playlistData);
        setArtists(artistData);
        setRealLikedCount(likedData.length);
      })
      .catch(() => {});
  }, [demoMode, playlistRevision, user]);

  const filteredPlaylists = useMemo(
    () => playlists.filter((playlist) =>
      (playlist.name || '').toLowerCase().includes(search.trim().toLowerCase())
    ),
    [playlists, search]
  );
  const filteredArtists = useMemo(
    () => artists.filter((artist) =>
      (artist.name || '').toLowerCase().includes(search.trim().toLowerCase())
    ),
    [artists, search]
  );

  const openCreatePlaylist = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setIsModalOpen(true);
  };

  const handleCreatePlaylist = async (playlistData) => {
    const playlist = await createPlaylist(playlistData);
    setPlaylists((current) => [playlist, ...current]);
    setIsModalOpen(false);
    window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
  };

  const { t } = useTranslation();
  const likedCountText = demoMode
    ? `${likedTracks.length} demo tracks`
    : `${realLikedCount} tracks`;

  const handleNav = (path) => {
    navigate(path);
    if (onItemClick) onItemClick();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 select-none">
      <div className="mb-3 flex items-center justify-between px-2">
        <button onClick={() => handleNav('/library')} className="flex items-center gap-2 text-zinc-200 cursor-pointer">
          <ListMusic size={16} className="text-brand-red" />
          <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label">{t('nav.yourLibrary')}</span>
        </button>
        <button onClick={openCreatePlaylist} className="ns-icon-button !min-h-9 !min-w-9 cursor-pointer" aria-label="Create playlist">
          <Plus size={15} />
        </button>
      </div>

      <div className="relative px-2 mb-3">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={13} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('nav.filterLibrary')}
          className="ns-field h-9 pl-9 pr-3 text-base"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1 space-y-4 pb-6">
        <div className="space-y-1.5">
          <button onClick={() => handleNav('/library?tab=liked')} className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-zinc-900/55">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-brand-red/20 bg-brand-red/10 text-brand-red">
              <Heart size={15} fill="currentColor" />
            </span>
            <span className="min-w-0 flex-1 truncate">
              <strong className="block text-sm text-zinc-200 truncate">{t('nav.likedSongs')}</strong>
              <small className="block text-ns-label text-zinc-500 truncate">{likedCountText}</small>
            </span>
          </button>
          <button onClick={() => handleNav('/library?tab=recently')} className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-zinc-900/55">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--ns-border-subtle)] bg-zinc-900 text-brand-red">
              <History size={15} />
            </span>
            <span className="min-w-0 flex-1 truncate">
              <strong className="block text-sm text-zinc-200 truncate">{t('nav.recentlyPlayed')}</strong>
              <small className="block text-ns-label text-zinc-500 truncate">{recentlyPlayed.length} tracks</small>
            </span>
          </button>
        </div>

        {filteredPlaylists.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="px-2 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">{t('nav.playlists')}</h3>
            {filteredPlaylists.map((playlist) => (
              <SidebarPlaylistItem key={playlist.id} playlist={playlist} />
            ))}
          </section>
        )}

        {filteredArtists.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="flex items-center gap-2 px-2 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">
              <Users size={12} />
              {demoMode ? 'Demo Artists' : t('nav.followedArtists')}
            </h3>
            {filteredArtists.map((artist) => (
              <SidebarArtistItem key={artist.id} artist={artist} />
            ))}
          </section>
        )}
      </div>

      <CreatePlaylistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreatePlaylist}
      />
    </div>
  );
}
