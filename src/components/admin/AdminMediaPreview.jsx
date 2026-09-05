import React, { useEffect, useId, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function mediaTime(value) {
  const seconds = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function AdminMediaPreview({
  title,
  description,
  url,
  type = 'audio',
  mediaLabel,
  unavailableLabel,
  errorLabel,
  className = '',
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const mediaRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setFailed(false);
    setPlaying(false);
    setDuration(0);
    setCurrentTime(0);
    const media = mediaRef.current;
    return () => media?.pause?.();
  }, [type, url]);

  const available = Boolean(url) && !failed;
  const playable = available && (type === 'audio' || type === 'video');
  const durationMax = Number.isFinite(duration) && duration > 0 ? duration : 0;

  const pauseOtherPreviews = (currentMedia) => {
    document.querySelectorAll('[data-admin-media-preview] audio, [data-admin-media-preview] video')
      .forEach((media) => {
        if (media !== currentMedia) media.pause();
      });
  };

  const togglePlayback = async () => {
    const media = mediaRef.current;
    if (!media) return;
    if (!media.paused) {
      media.pause();
      return;
    }
    pauseOtherPreviews(media);
    try {
      await media.play();
    } catch {
      setFailed(true);
    }
  };

  const seek = (event) => {
    const value = Number(event.target.value);
    if (!mediaRef.current || !Number.isFinite(value)) return;
    mediaRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const changeVolume = (event) => {
    const value = Number(event.target.value);
    if (!mediaRef.current || !Number.isFinite(value)) return;
    mediaRef.current.volume = value;
    setVolume(value);
  };

  const mediaEvents = {
    onLoadedMetadata: (event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0),
    onDurationChange: (event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0),
    onTimeUpdate: (event) => setCurrentTime(Number.isFinite(event.currentTarget.currentTime) ? event.currentTarget.currentTime : 0),
    onPlay: (event) => {
      pauseOtherPreviews(event.currentTarget);
      setPlaying(true);
    },
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onError: () => setFailed(true),
  };

  return (
    <section
      data-admin-media-preview
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={`min-w-0 rounded-md border border-[var(--ns-border-subtle)] p-4 ${className}`}
    >
      <div className="min-w-0">
        <h3 id={titleId} className="break-words [overflow-wrap:anywhere] text-sm font-bold text-[var(--ns-text)]">{title}</h3>
        {description && (
          <p id={descriptionId} className="mt-1 break-words [overflow-wrap:anywhere] text-ns-label text-[var(--ns-text-muted)]">
            {description}
          </p>
        )}
      </div>

      {available && type === 'image' && (
        <img
          src={url}
          alt={mediaLabel || title}
          className="mt-4 max-h-80 w-full rounded-md border border-[var(--ns-border-subtle)] object-contain"
          onError={() => setFailed(true)}
        />
      )}

      {available && type === 'audio' && (
        <audio
          key={`${type}-${url}`}
          ref={mediaRef}
          preload="metadata"
          src={url}
          aria-label={mediaLabel || title}
          className="hidden"
          {...mediaEvents}
        />
      )}

      {available && type === 'video' && (
        <video
          key={`${type}-${url}`}
          ref={mediaRef}
          preload="metadata"
          src={url}
          aria-label={mediaLabel || title}
          className="mt-4 block max-h-80 w-full max-w-full rounded-md border border-[var(--ns-border-subtle)]"
          {...mediaEvents}
        />
      )}

      {playable && (
        <div role="group" className="mt-4 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2" aria-label={t('admin.previewControls.controls')}>
          <button
            type="button"
            onClick={togglePlayback}
            className="ns-icon-button row-span-2 h-11 w-11 shrink-0"
            aria-label={t(playing ? 'admin.previewControls.pause' : 'admin.previewControls.play')}
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <input
              type="range"
              min="0"
              max={durationMax || 1}
              step="0.1"
              value={Math.min(currentTime, durationMax || 0)}
              disabled={!durationMax}
              onChange={seek}
              aria-label={t('admin.previewControls.seek')}
              aria-valuetext={`${mediaTime(currentTime)} / ${mediaTime(durationMax)}`}
              className="min-w-0 flex-1 accent-[var(--ns-accent)] disabled:opacity-40"
            />
            <output className="w-[6.5rem] shrink-0 text-right font-mono text-ns-meta tabular-nums text-[var(--ns-text-muted)]">
              {mediaTime(currentTime)} / {mediaTime(durationMax)}
            </output>
          </div>
          <label className="flex min-w-0 items-center gap-2">
            <Volume2 className="h-4 w-4 shrink-0 text-[var(--ns-text-muted)]" aria-hidden="true" />
            <span className="sr-only">{t('admin.previewControls.volume')}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={changeVolume}
              aria-label={t('admin.previewControls.volume')}
              className="min-w-0 flex-1 accent-[var(--ns-accent)]"
            />
          </label>
        </div>
      )}

      {!available && (
        <p className="mt-4 text-sm text-[var(--ns-text-muted)]" role={failed ? 'alert' : 'status'}>
          {failed ? (errorLabel || unavailableLabel) : unavailableLabel}
        </p>
      )}
    </section>
  );
}
