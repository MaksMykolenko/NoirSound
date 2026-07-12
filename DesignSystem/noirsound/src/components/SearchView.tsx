/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search as SearchIcon, Play, Heart, Disc, User, HelpCircle } from 'lucide-react';
import { Track, Artist } from '../types';

interface SearchViewProps {
  tracks: Track[];
  artists: Artist[];
  onSelectTrack: (trackId: string, playImmediately?: boolean) => void;
  onSelectArtist: (artistId: string) => void;
  likedTrackIds: string[];
  onToggleLike: (trackId: string) => void;
}

export default function SearchView({
  tracks,
  artists,
  onSelectTrack,
  onSelectArtist,
  likedTrackIds,
  onToggleLike,
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  // Popular pre-configured genres/tags for exploration
  const popularGenres = [
    'Пост-панк',
    'Колдвейв',
    'Лоу-фай Хаус',
    'Ембієнт',
    'Дарк-фолк',
    'Шугейз',
  ];

  // Perform search
  const filteredTracks = tracks.filter((t) => {
    const matchesQuery = query
      ? t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.artistName.toLowerCase().includes(query.toLowerCase()) ||
        t.genre.toLowerCase().includes(query.toLowerCase())
      : true;
    
    const matchesGenre = activeGenre
      ? t.genre.toLowerCase() === activeGenre.toLowerCase()
      : true;

    return matchesQuery && matchesGenre;
  });

  const filteredArtists = artists.filter((a) => {
    if (!query) return !activeGenre; // Only show artists if there is a query, unless browsing all
    return (
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.handle.toLowerCase().includes(query.toLowerCase())
    );
  });

  const isBrowsing = query || activeGenre;

  return (
    <div className="flex-1 min-h-screen pb-32 pt-6 px-8 max-w-5xl mx-auto">
      {/* Title */}
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl tracking-tight text-white">Пошук</h1>
        <p className="text-xs text-zinc-500 font-mono mt-1">Знайдіть улюблені треки, митців та інді-звучання</p>
      </div>

      {/* Heavy-duty elegant Search Bar */}
      <div className="relative mb-8">
        <SearchIcon className="absolute left-4 top-3.5 w-4.5 h-4.5 text-zinc-500" />
        <input
          type="text"
          placeholder="Шукати пісні, гурти, альбоми..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (activeGenre) setActiveGenre(null); // Clear genre filter on manual query
          }}
          className="w-full bg-[#111115] text-sm text-zinc-200 pl-12 pr-12 py-3 rounded-lg border border-white/[0.04] focus:outline-none focus:border-brand/40 transition-all font-sans placeholder-zinc-600 shadow-lg"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-3.5 text-xs text-zinc-500 hover:text-zinc-300 font-mono"
          >
            Очистити
          </button>
        )}
      </div>

      {/* Genres and Badges Exploration List */}
      <div className="mb-10">
        <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">
          Популярні інді-жанри
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setActiveGenre(null);
              setQuery('');
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium font-sans transition-all cursor-pointer border ${
              !activeGenre && !query
                ? 'bg-brand text-white border-brand'
                : 'bg-[#111115] text-zinc-400 border-white/[0.04] hover:border-zinc-800 hover:text-zinc-200'
            }`}
          >
            Всі жанри
          </button>
          {popularGenres.map((genre) => {
            const isActive = activeGenre === genre;
            return (
              <button
                key={genre}
                onClick={() => {
                  setActiveGenre(isActive ? null : genre);
                  setQuery('');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium font-sans transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-brand text-white border-brand shadow-[0_0_8px_rgba(244,63,94,0.25)]'
                    : 'bg-[#111115] text-zinc-400 border-white/[0.04] hover:border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Results Rendering */}
      {isBrowsing ? (
        <div className="space-y-10">
          
          {/* Artists Match (Only if present) */}
          {filteredArtists.length > 0 && (
            <section className="animate-fadeIn">
              <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">
                Знайдені виконавці ({filteredArtists.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredArtists.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => onSelectArtist(artist.id)}
                    className="flex items-center gap-3.5 p-3 rounded-lg bg-[#111115]/50 hover:bg-[#111115] border border-white/[0.03] transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-900 border border-white/[0.05]">
                      <img
                        src={artist.avatarUrl}
                        alt={artist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 group-hover:text-brand transition-colors">
                        {artist.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{artist.handle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tracks Results */}
          <section className="animate-fadeIn">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">
              {activeGenre ? `Релізи в жанрі: ${activeGenre}` : 'Знайдені треки'} ({filteredTracks.length})
            </h3>

            {filteredTracks.length === 0 ? (
              <div className="text-center py-12 border border-white/[0.02] bg-[#111115]/20 rounded-lg">
                <Disc className="w-8 h-8 text-zinc-700 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-zinc-500">За вашим запитом треків не знайдено.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-2.5 rounded hover:bg-zinc-900/60 transition-colors group"
                  >
                    <div
                      onClick={() => onSelectTrack(track.id, true)}
                      className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="text-[10px] text-zinc-600 font-mono w-5 text-center">0{idx + 1}</span>
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-zinc-200 group-hover:text-brand transition-colors">
                          {track.title}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{track.artistName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800/40 px-2 py-0.5 rounded border border-white/[0.02] hidden sm:inline-block">
                        {track.genre}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">{track.duration}</span>
                      <button
                        onClick={() => onToggleLike(track.id)}
                        className={`p-1.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer ${
                          likedTrackIds.includes(track.id) ? 'text-brand' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Heart
                          className="w-3.5 h-3.5"
                          fill={likedTrackIds.includes(track.id) ? 'currentColor' : 'none'}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      ) : (
        /* Empty Search state - Editorial suggestions */
        <div className="space-y-10 animate-fadeIn">
          {/* Hero Suggestion Panel */}
          <div className="bg-[#111115]/30 border border-white/[0.03] rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="max-w-md">
              <h3 className="text-sm font-semibold text-zinc-200 mb-1.5">Радіо інді-сцени NoirSound</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Шукайте за назвою, гуртом чи навіть окремими тегами як <span className="text-brand font-mono">#analog</span> чи <span className="text-brand font-mono">#реверберація</span>. Відкривайте унікальні сингли прямо зараз.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveGenre('Пост-панк');
              }}
              className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-xs font-medium rounded transition-all cursor-pointer shadow-md shrink-0 flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Слухати Пост-панк</span>
            </button>
          </div>

          {/* Quick recommendations */}
          <div>
            <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
              Нещодавні пошукові тренди
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {tracks.slice(0, 3).map((track) => (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track.id, true)}
                  className="p-3 bg-[#111115]/40 hover:bg-[#111115] border border-white/[0.01] hover:border-white/[0.04] rounded-lg cursor-pointer transition-all group flex items-center gap-3"
                >
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-10 h-10 rounded object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-300 group-hover:text-brand truncate">
                      {track.title}
                    </p>
                    <p className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate">{track.artistName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
