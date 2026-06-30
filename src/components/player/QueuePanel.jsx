import React, { useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { X, Play, Trash2, Music } from 'lucide-react';
import { formatDuration } from '../../utils/formatTime';
import FallbackCover from '../ui/FallbackCover';

export default function QueuePanel({ isOpen, onClose }) {
  const { queue, currentTrack, playTrack, removeFromQueue, setQueue } = usePlayerStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClearQueue = () => {
    setQueue([]);
  };

  return (
    <div className="fixed right-0 bottom-16 top-0 lg:bottom-[90px] lg:top-[73px] w-full sm:w-80 md:w-96 bg-zinc-950/98 border-l border-zinc-800/80 backdrop-blur-xl z-[60] lg:z-30 shadow-2xl flex flex-col glass-panel animate-slide-in" role="dialog" aria-modal="true" aria-labelledby="queue-title">
      {/* Queue Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900">
        <div className="flex items-center space-x-2">
          <Music size={16} className="text-brand-red" />
          <h2 id="queue-title" className="text-sm font-bold text-zinc-200">Play Queue</h2>
          <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
            {queue.length}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {queue.length > 0 && (
            <button
              onClick={handleClearQueue}
              className="min-h-11 px-2 text-xs text-zinc-400 hover:text-rose-400 transition-colors flex items-center space-x-1 cursor-pointer rounded-lg"
              aria-label="Clear play queue"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="ns-icon-button !min-h-10 !min-w-10 text-zinc-500 cursor-pointer"
            aria-label="Close play queue"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-zinc-500 space-y-2">
            <Music size={24} className="opacity-40" />
            <p className="text-sm font-medium">Queue is empty</p>
            <p className="text-xs max-w-[200px]">Add tracks to play next.</p>
          </div>
        ) : (
          queue.map((track, index) => {
            const isPlayingThis = currentTrack?.id === track.id;
            return (
              <div
                key={`${track.id}-${index}`}
                className={`group flex items-center space-x-3 p-2 rounded-xl transition-all duration-200 ${
                  isPlayingThis
                    ? 'bg-brand-red/10 border border-brand-red/20 shadow-[0_0_12px_var(--ns-accent-glow-soft)]'
                    : 'bg-zinc-900/30 border border-zinc-900/50 hover:bg-zinc-900/70 hover:border-zinc-800/80'
                }`}
              >
                {/* Cover art thumb */}
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 group-hover:opacity-80">
                  <FallbackCover
                    src={track.coverUrl}
                    title={track.title}
                    artistName={track.artistName}
                    genre={track.genre}
                    className="w-full h-full"
                    imageClassName="object-cover"
                  />
                  <button
                    onClick={() => playTrack(track)}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label={`Play ${track.title}`}
                  >
                    <Play size={14} className="text-white fill-white" />
                  </button>
                </div>

                {/* Track Details */}
                <div className="flex-1 min-w-0">
                  <h5
                    className={`text-xs font-semibold truncate ${
                      isPlayingThis ? 'text-brand-red' : 'text-zinc-200'
                    }`}
                  >
                    {track.title}
                  </h5>
                  <p className="text-[10px] text-zinc-500 truncate">by {track.artistName}</p>
                </div>

                {/* Duration and Actions */}
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {formatDuration(track.duration)}
                  </span>
                  <button
                    onClick={() => removeFromQueue(track.id)}
                    className="ns-icon-button !min-h-10 !min-w-10 md:opacity-0 md:group-hover:opacity-100 text-zinc-500 hover:text-rose-500 transition-all rounded-lg cursor-pointer"
                    aria-label={`Remove ${track.title} from queue`}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
