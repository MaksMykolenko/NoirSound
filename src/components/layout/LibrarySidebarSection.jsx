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
  getPlaylists,
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

  useEffect(() => {
    if (!user) {
      setPlaylists([]);
      setArtists([]);
      setRealLikedCount(0);
      return;
    }
    if (demoMode) {
      Promise.all([getPlaylists(), getArtists()])
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
  }, [demoMode, user]);

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

  const handleCreatePlaylist = async (name) => {
    const playlist = await createPlaylist({ name, description: '', isPublic: true });
    setPlaylists((current) => [playlist, ...current]);
    setIsModalOpen(false);
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
      <div className="flex items-center justify-between px-2 mb-3">
        <button onClick={() => handleNav('/library')} className="flex items-center gap-2 text-zinc-200 cursor-pointer">
          <ListMusic size={18} className="text-brand-red" />
          <span className="text-sm font-bold uppercase tracking-wider">{t('nav.yourLibrary')}</span>
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
          className="ns-field h-9 pl-9 pr-3 text-xs"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1 space-y-4 pb-6">
        <div className="space-y-1.5">
          <button onClick={() => handleNav('/library?tab=liked')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-900/55 text-left cursor-pointer transition-colors">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red to-purple-600 text-[var(--ns-on-accent)] flex items-center justify-center shrink-0">
              <Heart size={15} fill="currentColor" />
            </span>
            <span className="min-w-0 flex-1 truncate">
              <strong className="block text-sm text-zinc-200 truncate">{t('nav.likedSongs')}</strong>
              <small className="text-zinc-500 truncate">{likedCountText}</small>
            </span>
          </button>
          <button onClick={() => handleNav('/library?tab=recently')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-900/55 text-left cursor-pointer transition-colors">
            <span className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-brand-red shrink-0">
              <History size={15} />
            </span>
            <span className="min-w-0 flex-1 truncate">
              <strong className="block text-sm text-zinc-200 truncate">{t('nav.recentlyPlayed')}</strong>
              <small className="text-zinc-500 truncate">{recentlyPlayed.length} tracks</small>
            </span>
          </button>
        </div>

        {filteredPlaylists.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 px-2">{t('nav.playlists')}</h3>
            {filteredPlaylists.map((playlist) => (
              <SidebarPlaylistItem key={playlist.id} playlist={playlist} />
            ))}
          </section>
        )}

        {filteredArtists.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 px-2 flex items-center gap-2">
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
