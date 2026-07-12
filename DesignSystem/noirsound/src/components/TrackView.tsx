/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Pause, Heart, Plus, Share2, MessageSquare, BookOpen, ExternalLink, Calendar } from 'lucide-react';
import { Track, Comment, Artist } from '../types';

interface TrackViewProps {
  activeTrack: Track;
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
  playbackProgress: number;
  onProgressChange: (seconds: number) => void;
  likedTrackIds: string[];
  onToggleLike: (trackId: string) => void;
  onViewChange: (view: any) => void;
  artists: Artist[];
  tracks: Track[];
  comments: Comment[];
  onAddComment: (trackId: string, content: string) => void;
  onSelectTrack: (trackId: string, playImmediately?: boolean) => void;
}

export default function TrackView({
  activeTrack,
  isPlaying,
  onPlayPauseToggle,
  playbackProgress,
  onProgressChange,
  likedTrackIds,
  onToggleLike,
  onViewChange,
  artists,
  tracks,
  comments,
  onAddComment,
  onSelectTrack,
}: TrackViewProps) {
  const [commentText, setCommentText] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  // Filter comments for this specific track
  const trackComments = comments.filter((c) => c.trackId === activeTrack.id);

  // Get similar tracks (same genre or different track by same artist, or just other tracks)
  const similarTracks = tracks.filter((t) => t.id !== activeTrack.id).slice(0, 4);

  // Find track artist profile
  const artistInfo = artists.find((a) => a.id === activeTrack.artistId) || artists[0];

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(activeTrack.id, commentText.trim());
    setCommentText('');
  };

  const handleShareClick = () => {
    setCopiedShare(true);
    navigator.clipboard.writeText(window.location.href);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // Generate deterministic heights for the waveform bars
  const totalWaveformBars = 50;
  const waveformBars = Array.from({ length: totalWaveformBars }, (_, i) => {
    // Generate a pseudo-random bar height based on track title and index
    const seed = activeTrack.title.charCodeAt(i % activeTrack.title.length) || 42;
    const height = 15 + ((seed * (i + 3)) % 35); // Heights between 15% and 50%
    return height;
  });

  const handleWaveformClick = (index: number) => {
    const ratio = index / totalWaveformBars;
    const newSeconds = Math.floor(ratio * activeTrack.seconds);
    onProgressChange(newSeconds);
  };

  const activeBarIndex = Math.floor((playbackProgress / activeTrack.seconds) * totalWaveformBars);

  return (
    <div className="flex-1 min-h-screen pb-32 pt-6 px-8 max-w-5xl mx-auto">
      {/* Editorial Breadcrumb */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">
        <span className="hover:text-zinc-300 cursor-pointer" onClick={() => onViewChange('discover')}>Огляд</span>
        <span>/</span>
        <span className="text-zinc-300">{activeTrack.genre}</span>
        <span>/</span>
        <span className="text-zinc-400 truncate max-w-xs">{activeTrack.title}</span>
      </div>

      {/* Main Track Header Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        {/* Cover Art - Flat and simple, no glowing overlays */}
        <div className="md:col-span-1">
          <div className="aspect-square w-full rounded-sm overflow-hidden bg-zinc-900 border border-white/[0.04]">
            <img 
              src={activeTrack.coverUrl} 
              alt={activeTrack.title} 
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Track Core Info */}
        <div className="md:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono bg-zinc-950 text-zinc-400 px-2 py-0.5 rounded border border-white/[0.04] uppercase tracking-wide">
                {activeTrack.genre}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {activeTrack.releaseDate}
              </span>
            </div>
            
            <h1 className="font-display font-bold text-3xl md:text-4xl text-white tracking-tight mb-2">
              {activeTrack.title}
            </h1>
            
            <p className="text-zinc-400 font-medium text-sm flex items-center gap-1.5">
              <span>Автор:</span>
              <span 
                className="text-white hover:text-brand cursor-pointer hover:underline transition-all"
                onClick={() => onViewChange('artist')}
              >
                {activeTrack.artistName}
              </span>
            </p>
          </div>

          {/* Interactive Waveform Progress Panel */}
          <div className="my-6 bg-zinc-950/40 border border-white/[0.03] rounded-sm p-4">
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-2.5">
              <span>{formatTime(playbackProgress)} / {activeTrack.duration}</span>
              <span>{activeTrack.streamCount.toLocaleString()} прослуховувань</span>
            </div>

            {/* Clickable Waveform Bars */}
            <div className="h-12 flex items-end gap-[3px] px-1 select-none">
              {waveformBars.map((barHeight, idx) => {
                const isActive = idx <= activeBarIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => handleWaveformClick(idx)}
                    className="flex-1 cursor-pointer transition-all duration-150 relative group"
                    style={{ height: '100%' }}
                  >
                    {/* Inner bar */}
                    <div 
                      className={`absolute bottom-0 left-0 right-0 rounded-t-[1px] transition-all duration-150 ${
                        isActive 
                          ? 'bg-brand' 
                          : 'bg-zinc-800 hover:bg-zinc-600'
                      }`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onPlayPauseToggle}
              className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-white text-xs font-semibold px-5 py-2.5 rounded transition-all cursor-pointer shadow-md shadow-brand/10"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Пауза</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  <span>Прослухати</span>
                </>
              )}
            </button>

            <button
              onClick={() => onToggleLike(activeTrack.id)}
              className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded border transition-all cursor-pointer ${
                likedTrackIds.includes(activeTrack.id)
                  ? 'bg-brand/10 border-brand/30 text-brand'
                  : 'bg-transparent border-white/[0.04] text-zinc-300 hover:text-white hover:border-zinc-800'
              }`}
            >
              <Heart className="w-3.5 h-3.5" fill={likedTrackIds.includes(activeTrack.id) ? "currentColor" : "none"} />
              <span>{likedTrackIds.includes(activeTrack.id) ? 'Улюблений' : 'В улюблені'}</span>
            </button>

            <button
              onClick={handleShareClick}
              className="flex items-center gap-1.5 bg-transparent border border-white/[0.04] hover:border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium px-4 py-2.5 rounded transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedShare ? 'Посилання скопійовано!' : 'Поділитись'}</span>
            </button>

            <button
              onClick={() => onViewChange('lyrics')}
              className="flex items-center gap-1.5 bg-transparent border border-white/[0.04] hover:border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium px-4 py-2.5 rounded transition-all cursor-pointer ml-auto"
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
              <span>Текст пісні</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Content Area: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left 2 Columns: Description, Lyrics & Comments */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Track Description */}
          <div className="bg-[#111115]/40 border border-white/[0.03] rounded-sm p-6">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3">Опис треку</h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">{activeTrack.description}</p>
            
            {/* Tags Row */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {activeTrack.tags.map((tag, i) => (
                <span 
                  key={i} 
                  className="text-[9px] font-mono text-zinc-400 bg-zinc-900 border border-white/[0.03] px-2 py-0.5 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Lyrics Preview */}
          <div className="bg-[#111115]/20 border border-white/[0.03] rounded-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Фрагмент тексту</h3>
              <button 
                onClick={() => onViewChange('lyrics')}
                className="text-[10px] font-mono text-brand hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Відкрити караоке</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            
            <div className="text-sm text-zinc-300 space-y-1 bg-[#101013] p-4 rounded border border-white/[0.02] font-sans max-h-48 overflow-y-auto no-scrollbar">
              {activeTrack.lyrics.map((line, idx) => (
                <p key={idx} className={line === '' ? 'h-3' : 'leading-relaxed'}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Interactive Comments Panel */}
          <div>
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">
              Коментарі ({trackComments.length})
            </h3>

            {/* Comment Form */}
            <form onSubmit={handleCommentSubmit} className="mb-6 flex gap-3">
              <input
                type="text"
                placeholder="Залиште свій відгук про трек..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-[#111115] text-xs text-zinc-200 px-4 py-3 rounded border border-white/[0.04] focus:outline-none focus:border-brand/40 font-sans"
              />
              <button
                type="submit"
                className="bg-zinc-900 hover:bg-zinc-850 text-zinc-200 hover:text-white text-xs font-medium px-5 py-3 rounded border border-white/[0.04] transition-all cursor-pointer flex-shrink-0"
              >
                Опублікувати
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-4">
              {trackComments.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">Тут поки немає коментарів. Будьте першим!</p>
              ) : (
                trackComments.map((comment) => (
                  <div 
                    key={comment.id}
                    className="flex gap-3.5 p-4 rounded bg-[#111115]/30 border border-white/[0.01]"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-white/[0.05] flex-shrink-0">
                      <img 
                        src={comment.userAvatarUrl} 
                        alt={comment.userName} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-white">{comment.userName}</span>
                        <span className="text-[9px] font-mono text-zinc-500">{comment.timestamp}</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed font-sans">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Author Details & Similar tracks */}
        <div className="space-y-10">
          
          {/* Creator Mini-Profile Card */}
          <div className="bg-zinc-950/40 border border-white/[0.03] rounded-sm p-5 flex flex-col items-center text-center">
            <h4 className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Про автора</h4>
            <div 
              onClick={() => onViewChange('artist')}
              className="w-16 h-16 rounded-full overflow-hidden bg-zinc-900 border border-white/[0.04] cursor-pointer group"
            >
              <img 
                src={artistInfo.avatarUrl} 
                alt={artistInfo.name} 
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <h3 
              onClick={() => onViewChange('artist')}
              className="text-sm font-semibold text-white mt-3 hover:text-brand cursor-pointer"
            >
              {artistInfo.name}
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono">{artistInfo.handle}</p>
            <p className="text-[11px] text-zinc-400 mt-2.5 leading-relaxed truncate-3-lines px-1">
              {artistInfo.bio}
            </p>
            
            <button 
              onClick={() => onViewChange('artist')}
              className="mt-4 w-full bg-zinc-900 hover:bg-zinc-850 text-xs text-zinc-300 font-mono py-2 rounded border border-white/[0.03] transition-all cursor-pointer"
            >
              Читати більше
            </button>
          </div>

          {/* Similar Tracks List */}
          <div>
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">Схожі треки</h3>
            <div className="space-y-3">
              {similarTracks.map((track) => (
                <div 
                  key={track.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-zinc-900/40 transition-colors group cursor-pointer"
                  onClick={() => onSelectTrack(track.id, false)}
                >
                  <img 
                    src={track.coverUrl} 
                    alt={track.title} 
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-300 group-hover:text-brand transition-colors truncate">
                      {track.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">{track.artistName}</p>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0 pr-1">
                    {track.duration}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
