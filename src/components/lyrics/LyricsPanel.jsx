import React, { useEffect, useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getTrackLyrics } from '../../api/lyrics';
import FallbackCover from '../ui/FallbackCover';

export default function LyricsPanel({ open, track, onClose }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const [lyrics, setLyrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !track?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setLyrics(null);
    getTrackLyrics(track.id)
      .then((response) => {
        if (!cancelled) setLyrics(response);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || t('lyrics.unavailable'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, t, track?.id]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled])'
      ) || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open || !track) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-black/80 sm:flex sm:items-center sm:justify-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label={t('lyrics.close')} onClick={onClose} />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-lyrics-title"
        className="relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-b from-rose-950/95 via-zinc-950 to-black sm:h-[min(52rem,92vh)] sm:max-w-4xl sm:rounded-[2rem] sm:border sm:border-rose-400/20 sm:shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-white/10 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <FallbackCover
            src={track.coverUrl}
            title={track.title}
            artistName={track.artistName}
            genre={track.genre}
            className="h-12 w-12 shrink-0 rounded-xl border border-white/10"
            imageClassName="object-cover"
          />
          <div className="min-w-0 flex-1">
            <h2 id="player-lyrics-title" className="truncate text-base font-black text-white">{track.title}</h2>
            <p className="truncate text-sm text-zinc-300">{track.artistName}</p>
          </div>
          <button ref={closeRef} type="button" className="ns-icon-button !border-white/10 !bg-black/20 text-white" onClick={onClose} aria-label={t('lyrics.close')}>
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-10" data-testid="player-lyrics-body">
          {loading ? (
            <div className="space-y-5 animate-pulse" aria-label={t('lyrics.loading')}>
              {[80, 65, 90, 55, 75, 60].map((width) => (
                <div key={width} className="h-7 rounded-lg bg-white/10" style={{ width: `${width}%` }} />
              ))}
            </div>
          ) : error ? (
            <div className="grid min-h-64 place-items-center text-center">
              <div>
                <FileText className="mx-auto mb-3 text-zinc-500" size={32} />
                <p className="font-bold text-zinc-200">{t('lyrics.unavailable')}</p>
                <p className="mt-1 text-sm text-zinc-500">{error}</p>
              </div>
            </div>
          ) : lyrics?.hasLyrics ? (
            <p className="max-w-3xl whitespace-pre-wrap text-xl font-bold leading-[1.8] text-zinc-100 sm:text-2xl">
              {lyrics.lyricsText}
            </p>
          ) : (
            <div className="grid min-h-64 place-items-center text-center">
              <div>
                <FileText className="mx-auto mb-3 text-zinc-500" size={32} />
                <p className="font-bold text-zinc-200">{t('lyrics.noLyrics')}</p>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-white/10 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 text-xs text-zinc-400 sm:px-10">
          {t('lyrics.providedByArtist')}
        </footer>
      </section>
    </div>
  );
}
