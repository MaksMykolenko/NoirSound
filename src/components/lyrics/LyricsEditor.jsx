import React, { useMemo, useState } from 'react';
import { Eye, FileText, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { lyricsCounts, MAX_LYRICS_CHARACTERS, MAX_LYRICS_LINES } from './lyricsUtils';

export default function LyricsEditor({
  value,
  onChange,
  idPrefix = 'lyrics',
  compact = false,
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(false);
  const text = value.lyricsText || '';
  const counts = useMemo(() => lyricsCounts(text), [text]);
  const hasLyrics = Boolean(text.trim());
  const set = (field, nextValue) => onChange({ ...value, [field]: nextValue });

  return (
    <div className="space-y-4" data-testid="lyrics-editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <FileText size={16} className="text-brand-red" />
            {t('lyrics.optional')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">{t('upload.lyricsHelp')}</p>
        </div>
        <button
          type="button"
          className="ns-button-secondary inline-flex items-center gap-2 px-3 py-2 text-sm"
          onClick={() => setPreview((current) => !current)}
          aria-pressed={preview}
        >
          <Eye size={14} /> {t('lyrics.preview')}
        </button>
      </div>

      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'md:grid-cols-2'}`}>
        <label className="space-y-1.5">
          <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">{t('lyrics.language')}</span>
          <input
            id={`${idPrefix}-language`}
            className="ns-field px-4"
            value={value.lyricsLanguage || ''}
            onChange={(event) => set('lyricsLanguage', event.target.value)}
            placeholder="en, uk, pl, ru"
            maxLength={6}
          />
        </label>
        <label className="space-y-1.5">
          <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">{t('lyrics.type')}</span>
          <select
            id={`${idPrefix}-type`}
            className="ns-field px-4"
            value={hasLyrics ? 'PLAIN' : 'NONE'}
            disabled
            aria-label={t('lyrics.type')}
          >
            <option value="NONE">{t('lyrics.noLyrics')}</option>
            <option value="PLAIN">{t('lyrics.plain')}</option>
          </select>
        </label>
      </div>

      {preview ? (
        <div
          className="min-h-48 whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-7 text-zinc-200"
          aria-label={t('lyrics.preview')}
        >
          {text || t('lyrics.noLyrics')}
        </div>
      ) : (
        <label className="block space-y-1.5">
          <span className="sr-only">{t('lyrics.title')}</span>
          <textarea
            id={`${idPrefix}-text`}
            rows={compact ? 10 : 14}
            className="ns-field min-h-56 resize-y px-4 py-3 font-sans text-base leading-7 sm:text-sm"
            value={text}
            onChange={(event) => {
              const nextText = event.target.value;
              onChange({
                ...value,
                lyricsText: nextText,
                lyricsType: nextText.trim() ? 'PLAIN' : 'NONE',
                ...(nextText.trim() ? {} : { lyricsRightsConfirmed: false }),
              });
            }}
            placeholder={t('lyrics.textPlaceholder')}
            maxLength={MAX_LYRICS_CHARACTERS}
          />
        </label>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-ns-label text-zinc-500">
        <span>{counts.characters.toLocaleString()} / {MAX_LYRICS_CHARACTERS.toLocaleString()} {t('lyrics.characters')}</span>
        <span>{counts.lines.toLocaleString()} / {MAX_LYRICS_LINES.toLocaleString()} {t('lyrics.lines')}</span>
      </div>

      <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/40 p-4">
        <p className="text-sm leading-relaxed text-zinc-400">{t('lyrics.legalCopy')}</p>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(value.lyricsRightsConfirmed)}
            onChange={(event) => set('lyricsRightsConfirmed', event.target.checked)}
            className="mt-0.5 h-5 w-5 accent-brand-red"
          />
          <span className="text-sm leading-relaxed text-zinc-300">{t('lyrics.rightsConfirm')}</span>
        </label>
        {hasLyrics && !value.lyricsRightsConfirmed && (
          <p className="text-sm font-semibold text-amber-300" role="alert">{t('lyrics.rightsRequired')}</p>
        )}
      </div>

      {hasLyrics && (
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-rose-300 hover:text-rose-200"
          onClick={() => onChange({
            ...value,
            lyricsText: '',
            lyricsType: 'NONE',
            lyricsLanguage: '',
            lyricsRightsConfirmed: false,
          })}
        >
          <Trash2 size={14} /> {t('lyrics.remove')}
        </button>
      )}
    </div>
  );
}
