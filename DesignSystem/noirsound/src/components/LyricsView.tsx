/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Track } from '../types';

interface LyricsViewProps {
  activeTrack: Track;
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
  playbackProgress: number;
  onProgressChange: (seconds: number) => void;
  likedTrackIds: string[];
  onToggleLike: (trackId: string) => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
}

export default function LyricsView({
  activeTrack,
  isPlaying,
  onPlayPauseToggle,
  playbackProgress,
  onProgressChange,
  likedTrackIds,
  onToggleLike,
  onNextTrack,
  onPrevTrack,
}: LyricsViewProps) {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Filter empty lines to make mapping consistent
  const activeLines = activeTrack.lyrics.filter(l => l.trim() !== '');
  const totalLines = activeLines.length;
  
  // Deterministic mapping: split the track's total duration among the non-empty lyric lines
  const secondsPerLine = activeTrack.seconds / (totalLines || 1);
  const currentLineIndex = Math.min(
    Math.floor(playbackProgress / (secondsPerLine || 1)),
    totalLines - 1
  );

  // Auto-scroll the active lyric line to the center of the viewport
  useEffect(() => {
    const activeEl = document.getElementById(`lyric-line-${currentLineIndex}`);
    if (activeEl && lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTo({
        top: activeEl.offsetTop - lyricsContainerRef.current.clientHeight / 2 + activeEl.clientHeight / 2,
        behavior: 'smooth'
      });
    }
  }, [currentLineIndex]);

  const handleLineClick = (index: number) => {
    const targetSeconds = Math.floor(index * secondsPerLine);
    onProgressChange(targetSeconds);
  };

  return (
    <div id="immersive-lyrics-view" className="flex-1 min-h-[calc(100vh-80px)] pb-32 flex flex-col justify-between max-w-5xl mx-auto px-8 py-6">
      
      {/* Immersive Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 flex-1 items-center my-auto min-h-[400px]">
        {/* Left column: Cover Art and Minimalist details (Span 5) */}
        <div className="md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="w-64 h-64 md:w-80 md:h-80 rounded-sm overflow-hidden bg-zinc-900 border border-white/[0.04] shadow-2xl relative group">
            <img 
              src={activeTrack.coverUrl} 
              alt={activeTrack.title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
              <span className="text-[10px] font-mono tracking-wider text-white uppercase bg-zinc-900/90 px-3 py-1.5 rounded-sm border border-white/[0.05]">
                {activeTrack.genre}
              </span>
            </div>
          </div>
          
          <div className="mt-6 max-w-xs">
            <h2 className="font-display font-bold text-2xl text-white tracking-tight leading-tight">
              {activeTrack.title}
            </h2>
            <p className="text-sm font-mono text-zinc-400 mt-1">{activeTrack.artistName}</p>
            
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[9px] font-mono border border-white/[0.06] text-zinc-500 px-2 py-0.5 rounded uppercase">
                {activeTrack.genre}
              </span>
              <button 
                onClick={() => onToggleLike(activeTrack.id)}
                className={`p-1 rounded transition-colors cursor-pointer ${likedTrackIds.includes(activeTrack.id) ? 'text-brand' : 'text-zinc-600 hover:text-zinc-300'}`}
              >
                <Heart className="w-4 h-4" fill={likedTrackIds.includes(activeTrack.id) ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>

        {/* Center/Right column: Interactive Scrolling Lyrics (Span 7) */}
        <div className="md:col-span-7 flex flex-col h-[400px] justify-center relative">
          {/* Subtle top/bottom overlay fade */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#0a0a0c] to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0a0c] to-transparent z-10 pointer-events-none" />
          
          <div 
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto no-scrollbar py-20 px-2 space-y-6 select-none"
          >
            {activeLines.map((line, idx) => {
              const isActive = idx === currentLineIndex;
              return (
                <p
                  key={idx}
                  id={`lyric-line-${idx}`}
                  onClick={() => handleLineClick(idx)}
                  className={`text-base md:text-xl font-display font-medium leading-relaxed tracking-tight cursor-pointer transition-all duration-350 transform origin-left ${
                    isActive 
                      ? 'text-brand scale-105 opacity-100 font-bold progress-glow' 
                      : 'text-zinc-600 hover:text-zinc-400 opacity-60 hover:opacity-85'
                  }`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      {/* Prompt / Instruction for clicking lyrics */}
      <div className="mt-8 text-center text-zinc-600 text-xs font-mono">
        Клікніть на будь-який рядок тексту для швидкої навігації за часом треку
      </div>

    </div>
  );
}
