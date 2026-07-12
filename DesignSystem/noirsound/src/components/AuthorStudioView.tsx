/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Radio, Users, Play, Heart, FileText, CheckCircle, Clock, Plus, Disc, Edit3 } from 'lucide-react';
import { Track, UploadItem, Artist } from '../types';

interface AuthorStudioViewProps {
  tracks: Track[];
  userUploadedTracks: UploadItem[];
  onViewChange: (view: any) => void;
  artists: Artist[];
}

export default function AuthorStudioView({
  tracks,
  userUploadedTracks,
  onViewChange,
  artists,
}: AuthorStudioViewProps) {
  // Let's use the first artist "Силует" as the logged-in creator
  const artistObj = artists[0] || {
    id: 'art-1',
    name: 'Силует',
    handle: '@siluet_band',
    avatarUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    bio: 'Київський індивідуальний проект темного ковела та пост-панку. Аналоговий синтез, туманні реверберації та голос холодних міських вечорів.',
    followersCount: 840,
    verified: true
  };

  const artist = {
    ...artistObj,
    tags: ['Пост-панк', 'Колдвейв', 'Аналог'],
    followersCount: artistObj.followersCount || 840
  };

  const [bio, setBio] = useState(artist.bio);
  const [isEditingBio, setIsEditingBio] = useState(false);

  // Filter tracks by this artist
  const artistTracks = tracks.filter(t => t.artistId === artist.id || t.artistName === artist.name);

  // Calculate stats
  const totalStreams = artistTracks.reduce((sum, t) => sum + t.streamCount, 0) + 120; // some static seed
  const totalLikes = artistTracks.reduce((sum, t) => sum + t.likeCount, 0) + 48;

  return (
    <div className="flex-1 min-h-screen pb-32 pt-6 px-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-4 h-4 text-brand animate-pulse" />
            <span className="text-[10px] font-mono text-brand uppercase tracking-widest font-bold">Студія автора</span>
          </div>
          <h1 className="font-display font-bold text-2xl tracking-tight text-white">Кабінет творця: {artist.name}</h1>
          <p className="text-xs text-zinc-500 font-mono">Керуйте своїми релізами, переглядайте прослуховування та редагуйте профіль</p>
        </div>

        <button
          onClick={() => onViewChange('upload')}
          className="flex items-center gap-2 bg-brand hover:bg-brand/90 text-white text-xs font-semibold px-4 py-2.5 rounded transition-all shadow-lg self-start cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Завантажити новий трек</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="p-4 bg-[#111115]/40 border border-white/[0.02] rounded-lg">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Слухачі (Спільнота)</span>
          <p className="text-xl font-display font-bold text-white mt-1">{artist.followersCount.toLocaleString()}</p>
          <span className="text-[9px] font-mono text-brand/80 block mt-1">Органічне зростання</span>
        </div>

        <div className="p-4 bg-[#111115]/40 border border-white/[0.02] rounded-lg">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Загальні Стріми</span>
          <p className="text-xl font-display font-bold text-white mt-1">{totalStreams.toLocaleString()}</p>
          <span className="text-[9px] font-mono text-emerald-500 block mt-1">+14% за цей місяць</span>
        </div>

        <div className="p-4 bg-[#111115]/40 border border-white/[0.02] rounded-lg">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Отримано вподобань</span>
          <p className="text-xl font-display font-bold text-white mt-1">{totalLikes.toLocaleString()}</p>
          <span className="text-[9px] font-mono text-zinc-500 block mt-1">Збережено в медіатеку</span>
        </div>

        <div className="p-4 bg-[#111115]/40 border border-white/[0.02] rounded-lg">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Активні релізи</span>
          <p className="text-xl font-display font-bold text-brand mt-1">{artistTracks.length}</p>
          <span className="text-[9px] font-mono text-zinc-500 block mt-1">Всі треки активні</span>
        </div>
      </div>

      {/* Main Studio split view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Catalog Manager (Span 2) */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">
              Музичний каталог ({artistTracks.length})
            </h3>

            <div className="space-y-3">
              {artistTracks.map((track) => (
                <div
                  key={track.id}
                  className="p-3 bg-[#111115]/30 hover:bg-[#111115]/80 border border-white/[0.01] rounded-lg flex items-center justify-between gap-4 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded overflow-hidden bg-zinc-950 border border-white/[0.05] relative flex-shrink-0">
                      <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-brand transition-colors truncate">
                        {track.title}
                      </h4>
                      <p className="text-[10px] font-mono text-zinc-500 mt-1">
                        {track.genre} • {track.duration} • Опубліковано: {track.releaseDate || '2026-07'}
                      </p>
                    </div>
                  </div>

                  {/* Stats and status */}
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-mono font-medium text-zinc-300">{track.streamCount.toLocaleString()}</p>
                      <p className="text-[8px] font-mono text-zinc-600 uppercase">Стрімів</p>
                    </div>

                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-mono font-medium text-zinc-300">{track.likeCount.toLocaleString()}</p>
                      <p className="text-[8px] font-mono text-zinc-600 uppercase">Лайків</p>
                    </div>

                    <span className="text-[8px] font-mono px-2 py-0.5 rounded border uppercase bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                      Активний
                    </span>
                  </div>
                </div>
              ))}

              {artistTracks.length === 0 && (
                <div className="text-center py-12 border border-white/[0.02] bg-[#111115]/10 rounded-lg">
                  <Disc className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">У вас поки немає завантажених треків.</p>
                </div>
              )}
            </div>
          </section>

          {/* Pending Upload status tracking */}
          {userUploadedTracks.length > 0 && (
            <section className="bg-zinc-950/40 p-5 rounded-lg border border-white/[0.02]">
              <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3">
                Черга модерації та завантажень ({userUploadedTracks.filter(i => i.status !== 'publish').length})
              </h3>
              
              <div className="space-y-2.5">
                {userUploadedTracks.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs p-3.5 bg-[#111115]/50 rounded border border-white/[0.01]">
                    <div>
                      <span className="font-semibold text-zinc-300">{item.title}</span>
                      <span className="text-[10px] font-mono text-zinc-500 ml-2">({item.genre})</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.status !== 'publish' ? (
                        <div className="flex items-center gap-2 text-[10px] font-mono text-amber-500">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>Обробка правовласником ({item.progress}%)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-500">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Затверджено та додано</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column: Profile & Brand details (Span 1) */}
        <div className="space-y-6">
          <div className="bg-[#111115]/40 border border-white/[0.02] p-5 rounded-lg">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Профіль митця</span>
              <button 
                onClick={() => setIsEditingBio(!isEditingBio)}
                className="text-[10px] font-mono text-brand hover:underline cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-2.5 h-2.5" />
                <span>{isEditingBio ? 'Зберегти' : 'Редагувати'}</span>
              </button>
            </h3>

            <div className="flex flex-col items-center text-center pb-4 border-b border-white/[0.03] mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-900 border border-white/[0.04] mb-3">
                <img src={artist.avatarUrl} alt={artist.name} className="w-full h-full object-cover" />
              </div>
              <h4 className="text-sm font-semibold text-white">{artist.name}</h4>
              <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{artist.handle}</p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="block text-[9px] font-mono text-zinc-500 uppercase mb-1">Опис (Bio)</span>
                {isEditingBio ? (
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="w-full bg-[#0a0a0c] text-xs text-zinc-200 p-2 rounded border border-white/[0.05] focus:outline-none focus:border-brand/40 resize-none font-sans"
                  />
                ) : (
                  <p className="text-zinc-400 leading-relaxed font-sans">{bio}</p>
                )}
              </div>

              <div>
                <span className="block text-[9px] font-mono text-zinc-500 uppercase mb-1.5">Музичні напрямки</span>
                <div className="flex flex-wrap gap-1.5">
                  {artist.tags.map((tag: string, i: number) => (
                    <span key={i} className="text-[9px] font-mono bg-zinc-900 text-zinc-400 border border-white/[0.04] px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Artistic manifesto block */}
          <div className="bg-zinc-950/45 border border-white/[0.01] p-5 rounded-lg text-xs leading-relaxed text-zinc-500 font-sans space-y-3">
            <p className="font-semibold text-zinc-400">Правила свободи NoirSound</p>
            <p>
              Ми будуємо некомерційну, відкриту дистрибуцію української сцени. Публікуючи треки, ви зберігаєте 100% інтелектуальної власності. Наш плеєр підтримує аудіо високої чіткості для найкращого розкриття вашої ідеї.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
