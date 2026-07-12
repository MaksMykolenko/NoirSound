/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Play, Heart, Music, ListMusic, User, Trash, ArrowRight } from 'lucide-react';
import { Track, Playlist, Artist } from '../types';
import { useState, useEffect } from 'react';

interface LibraryViewProps {
  tracks: Track[];
  playlists: Playlist[];
  artists: Artist[];
  likedTrackIds: string[];
  onToggleLike: (trackId: string) => void;
  followedArtistIds: string[];
  onToggleFollow: (artistId: string) => void;
  onSelectTrack: (trackId: string, playImmediately?: boolean) => void;
  onSelectArtist: (artistId: string) => void;
  onViewChange: (view: any) => void;
  initialTab?: LibraryTab;
}

type LibraryTab = 'liked' | 'playlists' | 'recent' | 'artists';

export default function LibraryView({
  tracks,
  playlists,
  artists,
  likedTrackIds,
  onToggleLike,
  followedArtistIds,
  onToggleFollow,
  onSelectTrack,
  onSelectArtist,
  onViewChange,
  initialTab,
}: LibraryViewProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab || 'liked');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Filter actual liked tracks from master tracks list
  const likedTracks = tracks.filter((t) => likedTrackIds.includes(t.id));

  // Filter actual followed artists from master artists list
  const followedArtists = artists.filter((a) => followedArtistIds.includes(a.id));

  // Hardcode recently played tracks for realism
  const recentTracks = [tracks[2], tracks[0]]; // Kaseta - Реверберація, Силует - Тіні в тумані

  return (
    <div className="flex-1 min-h-screen pb-32 pt-6 px-8 max-w-5xl mx-auto">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl tracking-tight text-white">Медіатека</h1>
        <p className="text-xs text-zinc-500 font-mono mt-1">Ваша персональна збірка та вподобання</p>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-1 border-b border-white/[0.04] mb-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('liked')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 font-sans transition-all cursor-pointer flex-shrink-0 ${
            activeTab === 'liked'
              ? 'border-brand text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Улюблені треки ({likedTracks.length})
        </button>
        <button
          onClick={() => setActiveTab('playlists')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 font-sans transition-all cursor-pointer flex-shrink-0 ${
            activeTab === 'playlists'
              ? 'border-brand text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Плейлисти ({playlists.length})
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 font-sans transition-all cursor-pointer flex-shrink-0 ${
            activeTab === 'recent'
              ? 'border-brand text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Нещодавно прослухані
        </button>
        <button
          onClick={() => setActiveTab('artists')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 font-sans transition-all cursor-pointer flex-shrink-0 ${
            activeTab === 'artists'
              ? 'border-brand text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Підписки ({followedArtists.length})
        </button>
      </div>

      {/* Active Tab Contents */}
      <div className="min-h-[300px]">
        {/* TAB 1: LIKED TRACKS */}
        {activeTab === 'liked' && (
          <div className="space-y-2">
            {likedTracks.length === 0 ? (
              <div className="text-center py-16 border border-white/[0.02] bg-[#111115]/20 rounded-sm">
                <Heart className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-zinc-300">Тут поки нічого немає</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Позначте треки сердечком під час прослуховування, щоб зберегти їх тут.
                </p>
                <button 
                  onClick={() => onViewChange('discover')}
                  className="mt-4 text-xs font-mono text-brand hover:underline"
                >
                  Перейти до огляду
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {likedTracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-3 rounded bg-zinc-950/20 hover:bg-[#111115]/80 border border-white/[0.01] transition-all group"
                  >
                    <div 
                      onClick={() => onSelectTrack(track.id, true)}
                      className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="text-xs font-mono text-zinc-600 w-5 text-center">0{index + 1}</span>
                      <img 
                        src={track.coverUrl} 
                        alt={track.title} 
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-zinc-200 group-hover:text-brand transition-colors truncate">
                          {track.title}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">{track.artistName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-mono text-zinc-500 hidden md:block">
                        {track.genre}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        {track.duration}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(track.id);
                        }}
                        className="p-1.5 rounded hover:bg-zinc-800 text-brand hover:text-zinc-400 transition-colors cursor-pointer"
                        title="Видалити з улюблених"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PLAYLISTS */}
        {activeTab === 'playlists' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="group relative bg-[#111115]/30 hover:bg-[#111115]/80 p-4 rounded border border-white/[0.01] transition-all cursor-pointer flex flex-col justify-between"
                onClick={() => {
                  if (playlist.tracks.length > 0) {
                    onSelectTrack(playlist.tracks[0], true);
                  }
                }}
              >
                <div>
                  <div className="aspect-square w-full rounded overflow-hidden bg-zinc-900 border border-white/[0.03] mb-4">
                    <img 
                      src={playlist.coverUrl} 
                      alt={playlist.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h3 className="text-xs font-semibold text-white truncate group-hover:text-brand transition-colors">
                    {playlist.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-sans mt-1.5 line-clamp-2">
                    {playlist.description}
                  </p>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.02] text-[10px] font-mono text-zinc-500">
                  <span>Збірка</span>
                  <span>{playlist.trackCount} треків</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: RECENTLY PLAYED */}
        {activeTab === 'recent' && (
          <div className="space-y-1">
            {recentTracks.map((track, index) => (
              <div
                key={track.id}
                className="flex items-center justify-between p-3 rounded bg-zinc-950/10 hover:bg-[#111115]/80 border border-white/[0.01] transition-all group"
              >
                <div 
                  onClick={() => onSelectTrack(track.id, true)}
                  className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                >
                  <span className="text-xs font-mono text-zinc-600 w-5 text-center">0{index + 1}</span>
                  <img 
                    src={track.coverUrl} 
                    alt={track.title} 
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-zinc-200 group-hover:text-brand transition-colors truncate">
                      {track.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">{track.artistName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-mono text-zinc-500 hidden md:block">
                    {track.genre}
                  </span>
                  <span className="text-xs font-mono text-zinc-500">
                    {track.duration}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrack(track.id, true);
                    }}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: FOLLOWED ARTISTS */}
        {activeTab === 'artists' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {followedArtists.map((artist) => (
              <div
                key={artist.id}
                className="group p-4 bg-[#111115]/30 border border-white/[0.01] rounded hover:bg-[#111115]/80 transition-all text-center flex flex-col items-center cursor-pointer"
                onClick={() => onSelectArtist(artist.id)}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border border-white/[0.05] bg-zinc-950 mb-3">
                  <img 
                    src={artist.avatarUrl} 
                    alt={artist.name} 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <h4 className="text-xs font-semibold text-white group-hover:text-brand transition-colors">
                  {artist.name}
                </h4>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{artist.handle}</p>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFollow(artist.id);
                  }}
                  className="mt-3.5 text-[9px] font-mono bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white px-2.5 py-1 rounded border border-white/[0.04] transition-all cursor-pointer"
                >
                  Скасувати підписку
                </button>
              </div>
            ))}
            {followedArtists.length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-xs text-zinc-500">Ви ще не підписані на жодного виконавця.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
