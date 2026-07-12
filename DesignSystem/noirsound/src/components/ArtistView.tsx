/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Play, Check, Heart, ExternalLink, Calendar, Music, ArrowRight, Instagram, Twitter } from 'lucide-react';
import { Artist, Track } from '../types';

interface ArtistViewProps {
  activeArtist: Artist;
  tracks: Track[];
  onSelectTrack: (trackId: string, playImmediately?: boolean) => void;
  followedArtistIds: string[];
  onToggleFollow: (artistId: string) => void;
  likedTrackIds: string[];
  onToggleLike: (trackId: string) => void;
  onSelectArtist: (artistId: string) => void;
  allArtists: Artist[];
}

export default function ArtistView({
  activeArtist,
  tracks,
  onSelectTrack,
  followedArtistIds,
  onToggleFollow,
  likedTrackIds,
  onToggleLike,
  onSelectArtist,
  allArtists,
}: ArtistViewProps) {
  // Filter tracks belonging to this artist
  const artistTracks = tracks.filter((t) => t.artistId === activeArtist.id);

  const isFollowing = followedArtistIds.includes(activeArtist.id);

  return (
    <div className="flex-1 min-h-screen pb-32 pt-6 px-8 max-w-5xl mx-auto">
      {/* Artist Hero Banner */}
      <div className="relative h-64 md:h-80 rounded-sm overflow-hidden bg-zinc-900 border border-white/[0.04] mb-8">
        {/* Banner image */}
        <img 
          src={activeArtist.bannerUrl} 
          alt={activeArtist.name} 
          className="w-full h-full object-cover opacity-45 filter grayscale-[30%] blur-[2px] transition-transform duration-1000 hover:scale-102"
          referrerPolicy="no-referrer"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />

        {/* Content over banner */}
        <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-white/[0.08] bg-zinc-950 flex-shrink-0">
              <img 
                src={activeArtist.avatarUrl} 
                alt={activeArtist.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-2xl md:text-4xl text-white tracking-tight">
                  {activeArtist.name}
                </h1>
                {activeArtist.verified && (
                  <span className="bg-blue-500/20 text-blue-400 text-[9px] font-mono font-semibold px-2 py-0.5 rounded border border-blue-500/20 uppercase">
                    Перевірено
                  </span>
                )}
              </div>
              <p className="text-zinc-400 font-mono text-xs mt-1">{activeArtist.handle}</p>
              <p className="text-zinc-500 font-mono text-[10px] mt-2 uppercase tracking-wider">
                {activeArtist.followersCount.toLocaleString()} слухачів за місяць
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onToggleFollow(activeArtist.id)}
              className={`text-xs font-semibold px-5 py-2.5 rounded transition-all cursor-pointer border ${
                isFollowing
                  ? 'bg-zinc-900 border-white/[0.05] text-zinc-300'
                  : 'bg-white text-black border-white hover:bg-zinc-200'
              }`}
            >
              {isFollowing ? 'Ви підписані' : 'Підписатись'}
            </button>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left column: Popular tracks and Releases (Span 2) */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Popular Tracks Table */}
          <section>
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">Популярні треки</h3>
            
            <div className="space-y-1.5">
              {artistTracks.map((track, index) => {
                const isLiked = likedTrackIds.includes(track.id);
                return (
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
                        <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">{track.genre}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-mono text-zinc-500 hidden md:block">
                        {track.streamCount.toLocaleString()} прослуховувань
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        {track.duration}
                      </span>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(track.id);
                        }}
                        className={`p-1.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer ${isLiked ? 'text-brand' : 'text-zinc-600 hover:text-zinc-300'}`}
                      >
                        <Heart className="w-3.5 h-3.5" fill={isLiked ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {artistTracks.length === 0 && (
                <p className="text-xs text-zinc-500 py-3">У виконавця поки немає завантажених треків.</p>
              )}
            </div>
          </section>

          {/* Releases / Discography */}
          <section>
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">Релізи та сингли</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {artistTracks.map((track) => (
                <div 
                  key={track.id}
                  className="group bg-[#111115]/30 hover:bg-[#111115]/80 p-3 rounded border border-white/[0.01] transition-all cursor-pointer"
                  onClick={() => onSelectTrack(track.id, false)}
                >
                  <div className="aspect-square w-full rounded overflow-hidden bg-zinc-900 border border-white/[0.03] mb-3">
                    <img 
                      src={track.coverUrl} 
                      alt={track.title} 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h4 className="text-xs font-medium text-white truncate group-hover:text-brand transition-colors">
                    {track.title}
                  </h4>
                  <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-zinc-500">
                    <span>Сингл</span>
                    <span>{track.releaseDate.split('-')[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column: About, Socials, & Other Artists (Span 1) */}
        <div className="space-y-10">
          
          {/* Detailed About */}
          <section className="bg-[#111115]/40 border border-white/[0.03] rounded p-5">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4.5">Про виконавця</h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">{activeArtist.bio}</p>
            
            {/* Social Links Row */}
            <div className="mt-5 pt-5 border-t border-white/[0.04] space-y-2">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">Офіційні посилання</span>
              
              {activeArtist.socialLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-colors py-1 group"
                >
                  <span className="flex items-center gap-1.5 font-sans">
                    {link.platform === 'Instagram' ? (
                      <Instagram className="w-3.5 h-3.5 text-zinc-500" />
                    ) : (
                      <Music className="w-3.5 h-3.5 text-zinc-500" />
                    )}
                    {link.platform}
                  </span>
                  <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </a>
              ))}
            </div>
          </section>

          {/* Other Artists Slider / Recommendations */}
          <section>
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">Інші виконавці</h3>
            <div className="space-y-3">
              {allArtists
                .filter((a) => a.id !== activeArtist.id)
                .slice(0, 3)
                .map((artist) => (
                  <div
                    key={artist.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-zinc-900/30 transition-all cursor-pointer group"
                    onClick={() => onSelectArtist(artist.id)}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 border border-white/[0.05]">
                      <img 
                        src={artist.avatarUrl} 
                        alt={artist.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-300 group-hover:text-brand transition-colors">
                        {artist.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono">{artist.handle}</p>
                    </div>
                  </div>
                ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
