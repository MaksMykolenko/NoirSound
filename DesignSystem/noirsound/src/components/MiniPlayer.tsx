/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Heart, 
  MoreHorizontal, 
  Shuffle, 
  Repeat, 
  FileText, 
  ListMusic, 
  Volume2, 
  VolumeX, 
  X 
} from 'lucide-react';
import { Track, ViewType } from '../types';

interface MiniPlayerProps {
  activeTrack: Track;
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
  playbackProgress: number;
  onProgressChange: (seconds: number) => void;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  likedTrackIds: string[];
  onToggleLike: (trackId: string) => void;
}

export default function MiniPlayer({
  activeTrack,
  isPlaying,
  onPlayPauseToggle,
  playbackProgress,
  onProgressChange,
  currentView,
  onViewChange,
  volume,
  onVolumeChange,
  onNextTrack,
  onPrevTrack,
  likedTrackIds,
  onToggleLike,
}: MiniPlayerProps) {
  const previousVolume = useRef(volume);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  // Simulated active playback when isPlaying is true
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        onProgressChange((playbackProgress + 1) % activeTrack.seconds);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackProgress, activeTrack.seconds, onProgressChange]);

  const handleVolumeToggle = () => {
    if (volume > 0) {
      previousVolume.current = volume;
      onVolumeChange(0);
    } else {
      onVolumeChange(previousVolume.current || 80);
    }
  };

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPercent = (playbackProgress / activeTrack.seconds) * 100;

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickRatio = clickX / width;
    const newSeconds = Math.floor(clickRatio * activeTrack.seconds);
    onProgressChange(newSeconds);
  };

  const handleVolumeBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickRatio = Math.max(0, Math.min(1, clickX / width));
    const newVolume = Math.round(clickRatio * 100);
    onVolumeChange(newVolume);
  };

  const isLiked = likedTrackIds.includes(activeTrack.id);

  return (
    <div
      id="mini-audio-player"
      className="fixed bottom-0 left-0 right-0 bg-[#0c0c0e]/95 backdrop-blur-md border-t border-white/[0.04] z-40 p-4 px-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 shadow-2xl h-auto md:h-20"
    >
      {/* LEFT: Song Details, Heart, More Options */}
      <div className="flex items-center gap-4 w-full md:w-80 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div 
            onClick={() => onViewChange('track')}
            className="w-11 h-11 rounded overflow-hidden bg-zinc-900 border border-white/[0.04] cursor-pointer flex-shrink-0 shadow-md relative"
          >
            <img 
              src={activeTrack.coverUrl} 
              alt={activeTrack.title} 
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="overflow-hidden min-w-0 pr-1">
            <h4 
              onClick={() => onViewChange('track')}
              className="text-xs font-semibold text-zinc-100 hover:text-brand cursor-pointer truncate transition-colors"
            >
              {activeTrack.title}
            </h4>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate hover:text-zinc-300 cursor-pointer transition-colors" onClick={() => onViewChange('artist')}>
              {activeTrack.artistName}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => onToggleLike(activeTrack.id)}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all cursor-pointer ${
              isLiked 
                ? 'text-brand bg-brand/5 hover:bg-brand/10' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
            title={isLiked ? 'Видалити з улюблених' : 'Додати до улюблених'}
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-brand' : ''}`} />
          </button>

          <button 
            className="w-8 h-8 rounded-md hover:bg-white/[0.04] flex items-center justify-center transition-all cursor-pointer text-zinc-400 hover:text-zinc-200"
            title="Опції"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* MIDDLE: Controls stacked vertically */}
      <div className="flex-1 flex flex-col items-center max-w-xl w-full">
        {/* Controls Row */}
        <div className="flex items-center gap-4 mb-1.5">
          <button 
            onClick={() => setIsShuffle(!isShuffle)}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all cursor-pointer ${isShuffle ? 'text-brand bg-brand/5' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]'}`}
            title="Випадковий порядок"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          <button 
            onClick={onPrevTrack}
            className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02] transition-all cursor-pointer"
            title="Попередній трек"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>
          
          <button 
            onClick={onPlayPauseToggle}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-100 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer shrink-0"
            title={isPlaying ? 'Пауза' : 'Грати'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-black fill-black" />
            ) : (
              <Play className="w-3.5 h-3.5 text-black fill-black ml-0.5" />
            )}
          </button>

          <button 
            onClick={onNextTrack}
            className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02] transition-all cursor-pointer"
            title="Наступний трек"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          <button 
            onClick={() => setIsRepeat(!isRepeat)}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all cursor-pointer ${isRepeat ? 'text-brand bg-brand/5' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]'}`}
            title="Повторення"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timeline Row */}
        <div className="w-full flex items-center gap-3">
          <span className="text-[10px] text-zinc-500 font-mono w-8 text-right select-none">
            {formatTime(playbackProgress)}
          </span>
          
          <div 
            onClick={handleProgressBarClick}
            className="flex-1 h-5 flex items-center cursor-pointer relative group"
          >
            {/* Inactive Track */}
            <div className="absolute left-0 right-0 h-1 bg-zinc-800 group-hover:h-1.5 rounded-full transition-all duration-150" />
            {/* Active Track */}
            <div 
              className="absolute left-0 h-1 bg-brand group-hover:h-1.5 rounded-full transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Thumb */}
            <div 
              className="absolute w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 -translate-x-1/2 transition-all duration-150 shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          <span className="text-[10px] text-zinc-500 font-mono w-8 text-left select-none">
            {activeTrack.duration}
          </span>
        </div>
      </div>

      {/* FAR RIGHT: Utility Actions (Lyrics, Queue, Volume, Close) */}
      <div className="flex items-center justify-end gap-3 w-full md:w-80 shrink-0 text-zinc-400">
        <button 
          onClick={() => onViewChange('lyrics')}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            currentView === 'lyrics' ? 'text-brand bg-brand/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
          title="Текст пісні (Екран караоке)"
        >
          <FileText className="w-4 h-4" />
        </button>
        
        <button 
          onClick={() => onViewChange('library')}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            currentView === 'library' ? 'text-brand bg-brand/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
          title="Плейлісти"
        >
          <ListMusic className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 group">
          <button 
            onClick={handleVolumeToggle}
            className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
            title="Гучність"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4 text-zinc-500" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          
          <div 
            onClick={handleVolumeBarClick}
            className="w-20 h-5 flex items-center cursor-pointer relative group/vbar"
          >
            {/* Inactive Track */}
            <div className="absolute left-0 right-0 h-1 bg-zinc-800 group-hover/vbar:h-1.5 rounded-full transition-all duration-150" />
            {/* Active Track */}
            <div 
              className="absolute left-0 h-1 bg-zinc-400 group-hover/vbar:bg-brand group-hover/vbar:h-1.5 rounded-full transition-all duration-150"
              style={{ width: `${volume}%` }}
            />
            {/* Thumb */}
            <div 
              className="absolute w-3 h-3 rounded-full bg-white opacity-0 group-hover/vbar:opacity-100 scale-75 group-hover/vbar:scale-100 -translate-x-1/2 transition-all duration-150 shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
              style={{ left: `${volume}%` }}
            />
          </div>
        </div>

        <button 
          onClick={() => onViewChange('discover')}
          className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Закрити плеєр / На головну"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
