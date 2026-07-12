import React, { useEffect, useRef, useState } from 'react';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getManageTrackLyrics, updateTrackLyrics } from '../../api/lyrics';
import LyricsEditor from './LyricsEditor';
import { lyricsCounts, MAX_LYRICS_LINES } from './lyricsUtils';

const EMPTY_FORM = {
  lyricsText: '',
  lyricsType: 'NONE',
  lyricsLanguage: '',
  lyricsRightsConfirmed: false,
};

export default function LyricsEditModal({ open, track, onClose, onSaved }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !track?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    getManageTrackLyrics(track.id)
      .then((lyrics) => {
        if (cancelled) return;
        setForm({
          lyricsText: lyrics.lyricsText || '',
          lyricsType: lyrics.hasLyrics ? (lyrics.lyricsType || 'PLAIN') : 'NONE',
          lyricsLanguage: lyrics.lyricsLanguage || '',
          lyricsRightsConfirmed: Boolean(lyrics.hasLyrics),
        });
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
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]'
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

  const save = async () => {
    const text = form.lyricsText.trim();
    const counts = lyricsCounts(form.lyricsText);
    if (counts.lines > MAX_LYRICS_LINES) {
      setError(t('lyrics.tooLong'));
      return;
    }
    if (text && !form.lyricsRightsConfirmed) {
      setError(t('lyrics.rightsRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await updateTrackLyrics(track.id, {
        lyricsText: form.lyricsText,
        lyricsType: text ? 'PLAIN' : 'NONE',
        lyricsLanguage: text ? form.lyricsLanguage || null : null,
        lyricsRightsConfirmed: text ? form.lyricsRightsConfirmed : false,
      });
      onSaved?.(result);
      onClose();
    } catch (requestError) {
      setError(requestError.data?.message || requestError.message || t('lyrics.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[var(--ns-z-dialog)] flex items-end justify-center bg-black/75 sm:items-center sm:p-5">
      <button type="button" className="absolute inset-0" aria-label={t('lyrics.close')} onClick={onClose} />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lyrics-edit-title"
        className="relative max-h-[94vh] w-full overflow-y-auto rounded-t-lg border border-zinc-700/70 bg-zinc-950 p-5 shadow-xl sm:max-w-3xl sm:rounded-lg"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-950 pb-4">
          <div>
            <span className="ns-eyebrow text-brand-red">{t('lyrics.editLyrics')}</span>
            <h2 id="lyrics-edit-title" className="mt-1 font-display text-lg font-semibold tracking-tight text-zinc-100">{track.title}</h2>
          </div>
          <button ref={closeRef} type="button" className="ns-icon-button" onClick={onClose} aria-label={t('lyrics.close')}>
            <X size={20} />
          </button>
        </header>

        <div className="py-5">
          {loading ? (
            <div className="space-y-3 animate-pulse" aria-label={t('lyrics.loading')}>
              <div className="h-10 rounded-md bg-zinc-900" />
              <div className="h-64 rounded-md bg-zinc-900" />
            </div>
          ) : (
            <LyricsEditor value={form} onChange={setForm} idPrefix={`edit-${track.id}`} />
          )}
          {error && <p className="mt-4 rounded-md border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">{error}</p>}
        </div>

        <footer className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950 pt-4">
          <button
            type="button"
            className="ns-button-primary inline-flex w-full items-center justify-center gap-2 px-5"
            disabled={saving || loading}
            onClick={save}
          >
            <Save size={16} /> {saving ? t('lyrics.saving') : t('lyrics.save')}
          </button>
        </footer>
      </section>
    </div>
  );
}
