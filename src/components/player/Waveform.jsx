import React, { useMemo } from 'react';
import { AudioLines } from 'lucide-react';

export default function Waveform({
  samples,
  progress = 0,
  duration = 0,
  onSeek,
  barCount = 80,
  height = 60,
  unavailableLabel = 'Waveform data is not available for this release.',
}) {
  const bars = useMemo(() => {
    if (!Array.isArray(samples) || samples.length === 0) return [];
    const step = Math.max(1, Math.floor(samples.length / barCount));
    return samples
      .filter((_, index) => index % step === 0)
      .slice(0, barCount)
      .map((sample) => Math.max(0.05, Math.min(1, Math.abs(Number(sample) || 0))));
  }, [barCount, samples]);

  if (bars.length === 0) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 text-xs text-zinc-500"
        style={{ minHeight: height }}
        role="img"
        aria-label={unavailableLabel}
      >
        <AudioLines size={15} className="opacity-70" aria-hidden="true" />
        <span>{unavailableLabel}</span>
      </div>
    );
  }

  const activeIndex = duration > 0
    ? Math.floor((progress / duration) * bars.length)
    : 0;

  const handleClick = (event) => {
    if (!onSeek || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(((event.clientX - rect.left) / rect.width) * duration);
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={(event) => {
        if (!onSeek || duration <= 0) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          const delta = event.key === 'ArrowRight' ? 5 : -5;
          onSeek(Math.min(duration, Math.max(0, progress + delta)));
        }
      }}
      role={onSeek ? 'slider' : 'img'}
      tabIndex={onSeek ? 0 : -1}
      aria-label="Track waveform"
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? duration : undefined}
      aria-valuenow={onSeek ? progress : undefined}
      className={`flex items-center justify-between w-full py-2 rounded-lg ${
        onSeek ? 'cursor-pointer hover:bg-zinc-900/40' : ''
      }`}
      style={{ height }}
    >
      {bars.map((value, index) => (
        <div
          key={index}
          className={index <= activeIndex ? 'w-[3px] rounded-full bg-brand-red' : 'w-[3px] rounded-full bg-zinc-600'}
          style={{ height: `${Math.max(4, value * height)}px` }}
        />
      ))}
    </div>
  );
}
