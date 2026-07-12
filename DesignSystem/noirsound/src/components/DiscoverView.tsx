/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Play, Heart, Plus, Compass, Clock, ArrowRight } from 'lucide-react';
import { Track, Artist, Playlist } from '../types';

interface DiscoverViewProps {
  tracks: Track[];
  artists: Artist[];
  playlists: Playlist[];
  onSelectTrack: (trackId: string, playImmediately?: boolean) => void;
  onSelectArtist: (artistId: string) => void;
  likedTrackIds: string[];
  onToggleLike: (trackId: string) => void;
  onViewChange: (view: any) => void;
}

export default function DiscoverView({
  tracks,
  artists,
  playlists,
  onSelectTrack,
  onSelectArtist,
  likedTrackIds,
  onToggleLike,
  onViewChange,
}: DiscoverViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tracks based on search query
  const filteredTracks = searchQuery
    ? tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.artistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.genre.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="flex-1 min-h-screen pb-32 pt-6 px-8 max-w-5xl mx-auto">
      {/* Header & Search */}
      <div className="flex items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight text-white">Огляд</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">Нова та автентична українська інді-сцена</p>
        </div>

        {/* Search Input Container */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Шукати треки, авторів чи жанри..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111115] text-xs text-zinc-200 pl-9 pr-4 py-2 rounded border border-white/[0.04] focus:outline-none focus:border-brand/40 transition-all font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-[10px] text-zinc-500 hover:text-zinc-300 font-mono"
            >
              Очистити
            </button>
          )}
        </div>
      </div>

      {/* Interactive Search Results Block */}
      {searchQuery && (
        <div className="mb-10 bg-[#111115] border border-white/[0.05] rounded-md p-6">
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">
            Результати пошуку ({filteredTracks.length})
          </h3>
          {filteredTracks.length === 0 ? (
            <p className="text-sm text-zinc-500 py-2">Нічого не знайдено за вашим запитом.</p>
          ) : (
            <div className="space-y-2">
              {filteredTracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-zinc-900 transition-colors group"
                >
                  <div
                    onClick={() => {
                      onSelectTrack(track.id, true);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-10 h-10 rounded object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="truncate">
                      <p className="text-xs font-medium text-white group-hover:text-brand transition-colors">
                        {track.title}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{track.artistName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800/40 px-2 py-0.5 rounded border border-white/[0.02]">
                      {track.genre}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">{track.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left 2 Columns: Main Music Discovery */}
        <div className="lg:col-span-2 space-y-10">
          {/* Section: New Releases */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-sans text-sm font-semibold text-zinc-200">Нові релізи</h3>
              <span className="text-[10px] font-mono text-zinc-500 hover:text-brand cursor-pointer transition-colors">Всі релізи ({tracks.length})</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {tracks.slice(0, 6).map((track) => (
                <div 
                  key={track.id} 
                  className="group relative flex flex-col rounded-lg bg-[#111115]/30 hover:bg-[#111115]/80 p-3 border border-white/[0.02] hover:border-white/[0.08] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-300"
                >
                  {/* Artwork wrapper with play button trigger */}
                  <div className="relative aspect-square rounded overflow-hidden bg-zinc-900 border border-white/[0.03] mb-3">
                    <img 
                      src={track.coverUrl} 
                      alt={track.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    {/* Visual play overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <button 
                        onClick={() => onSelectTrack(track.id, true)}
                        className="w-11 h-11 rounded-full bg-brand hover:bg-brand-hover text-white flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                        title="Грати трек"
                      >
                        <Play className="w-4.5 h-4.5 fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Metadata */}
                  <h4 
                    onClick={() => onSelectTrack(track.id, false)}
                    className="text-xs font-semibold text-zinc-200 group-hover:text-brand cursor-pointer truncate transition-colors"
                  >
                    {track.title}
                  </h4>

                  <div className="flex items-center justify-between mt-1">
                    <p 
                      onClick={() => onSelectArtist(track.artistId)}
                      className="text-[10px] text-zinc-500 font-mono truncate hover:text-zinc-300 cursor-pointer transition-colors max-w-[75%]"
                    >
                      {track.artistName}
                    </p>
                    <span className="text-[9px] text-zinc-600 font-mono shrink-0">{track.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Popular Playlists */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-sans text-sm font-semibold text-zinc-200">Популярні плейлисти</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {playlists.map((playlist) => (
                <div 
                  key={playlist.id}
                  className="group relative bg-[#111115]/50 hover:bg-[#111115] rounded-lg border border-white/[0.03] p-3 flex items-center gap-3 transition-all duration-200 cursor-pointer"
                  onClick={() => {
                    // Select first track of playlist
                    if (playlist.tracks.length > 0) {
                      onSelectTrack(playlist.tracks[0], true);
                    }
                  }}
                >
                  <div className="w-12 h-12 rounded bg-zinc-900 overflow-hidden flex-shrink-0 border border-white/[0.04]">
                    <img 
                      src={playlist.coverUrl} 
                      alt={playlist.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-zinc-200 truncate group-hover:text-brand transition-colors">
                      {playlist.name}
                    </h4>
                    <p className="text-[9px] font-mono text-zinc-500 mt-0.5">
                      {playlist.trackCount} треків
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right 1 Column: Queue/Continue Listening + Recommended Creators */}
        <div className="space-y-10">
          {/* Section: Continue Listening */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-sans text-sm font-semibold text-zinc-200">Продовжити слухати</h3>
            </div>
            
            <div className="space-y-2.5">
              {tracks.slice(1, 4).map((track, idx) => (
                <div 
                  key={track.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#111115]/30 hover:bg-[#111115]/80 border border-white/[0.01] transition-all duration-150 group"
                >
                  <div 
                    onClick={() => onSelectTrack(track.id, false)}
                    className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                  >
                    <span className="text-xs text-zinc-600 font-mono w-4 text-center">0{idx + 1}</span>
                    <img 
                      src={track.coverUrl} 
                      alt={track.title} 
                      className="w-9 h-9 rounded object-cover flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="truncate">
                      <p className="text-xs font-semibold text-zinc-300 group-hover:text-brand transition-colors truncate">
                        {track.title}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">{track.artistName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => onSelectTrack(track.id, true)}
                      className="p-1.5 text-zinc-500 hover:text-brand hover:bg-zinc-800/60 rounded-md transition-all cursor-pointer"
                      title="Слухати"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button 
                      onClick={() => onToggleLike(track.id)}
                      className={`p-1.5 rounded-md hover:bg-zinc-800/60 transition-all cursor-pointer ${likedTrackIds.includes(track.id) ? 'text-brand' : 'text-zinc-500 hover:text-zinc-300'}`}
                      title={likedTrackIds.includes(track.id) ? "Видалити з улюблених" : "Додати в улюблені"}
                    >
                      <Heart className="w-3.5 h-3.5" fill={likedTrackIds.includes(track.id) ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Recommended Artists */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-sans text-sm font-semibold text-zinc-200">Автори тижня</h3>
            </div>
            
            <div className="space-y-3">
              {artists.map((artist) => (
                <div 
                  key={artist.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#111115]/60 transition-all duration-150 group"
                >
                  <div 
                    onClick={() => onSelectArtist(artist.id)}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-900 border border-white/[0.04]">
                      <img 
                        src={artist.avatarUrl} 
                        alt={artist.name} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-zinc-200 group-hover:text-brand transition-colors">
                          {artist.name}
                        </span>
                        {artist.verified && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" title="Перевірений автор" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">{artist.handle}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => onSelectArtist(artist.id)}
                    className="text-[10px] font-mono text-zinc-400 hover:text-white bg-[#111115]/80 px-2.5 py-1 rounded border border-white/[0.03] hover:border-zinc-800 transition-all cursor-pointer"
                  >
                    Профіль
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
