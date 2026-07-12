import React, { useEffect, useState } from 'react';
import { FileText, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getTrackLyrics } from '../../api/lyrics';
import LyricsEditModal from './LyricsEditModal';

export default function TrackLyricsCard({ track, canEdit = false, onLyricsChanged }) {
  const { t } = useTranslation();
  const [lyrics, setLyrics] = useState(track.hasLyrics ? null : { trackId: track.id, hasLyrics: false });
  const [loading, setLoading] = useState(Boolean(track.hasLyrics));
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!track.hasLyrics) {
      setLyrics({ trackId: track.id, hasLyrics: false });
      setLoading(false);
      setError('');
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    getTrackLyrics(track.id)
      .then((response) => {
        if (!cancelled) {
          setLyrics(response);
          setError('');
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || t('lyrics.unavailable'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [t, track.hasLyrics, track.id]);

  const handleSaved = (result) => {
    if (result.hasLyrics) {
      getTrackLyrics(track.id).then(setLyrics).catch(() => {});
    } else {
      setLyrics({ trackId: track.id, hasLyrics: false });
    }
    onLyricsChanged?.(result);
  };

  return (
    <>
      <section className="border-y border-zinc-800/60 px-1 py-6 sm:px-3" data-testid="track-lyrics-card">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 className="ns-section-title flex items-center gap-2">
            <FileText size={18} className="text-brand-red" />
            {t('lyrics.title')}
          </h2>
          {canEdit && (
            <button type="button" className="ns-button-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> {lyrics?.hasLyrics ? t('lyrics.editLyrics') : t('lyrics.addLyrics')}
            </button>
          )}
        </header>

        {loading ? (
          <div className="space-y-3 animate-pulse" aria-label={t('lyrics.loading')}>
            <div className="h-5 w-4/5 rounded bg-zinc-900" />
            <div className="h-5 w-3/5 rounded bg-zinc-900" />
            <div className="h-5 w-2/3 rounded bg-zinc-900" />
          </div>
        ) : error ? (
          <p className="text-sm text-zinc-500">{t('lyrics.unavailable')}</p>
        ) : lyrics?.hasLyrics ? (
          <p className="max-w-2xl whitespace-pre-wrap text-base leading-8 text-zinc-300">{lyrics.lyricsText}</p>
        ) : (
          <p className="text-sm text-zinc-500">{t('lyrics.noLyrics')}</p>
        )}
      </section>

      <LyricsEditModal
        open={editing}
        track={track}
        onClose={() => setEditing(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
