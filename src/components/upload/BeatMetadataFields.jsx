import React from 'react';
import { useTranslation } from 'react-i18next';

export default function BeatMetadataFields({ value, onChange, idPrefix = 'beat-metadata' }) {
  const { t } = useTranslation();
  const set = (field, nextValue) => onChange({ ...value, [field]: nextValue });

  return (
    <fieldset className="space-y-4 border-y border-zinc-800/70 py-5" data-testid="beat-metadata-fields">
      <legend className="text-base font-semibold text-zinc-100">{t('beats.beatMetadata')}</legend>
      <p className="text-sm text-zinc-500">{t('beats.metadataHelp')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5" htmlFor={`${idPrefix}-bpm`}>
          <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('beats.bpm')}</span>
          <input
            id={`${idPrefix}-bpm`}
            type="number"
            inputMode="numeric"
            min="40"
            max="240"
            className="ns-field !rounded px-4 text-base sm:text-sm"
            placeholder={t('beats.bpmPlaceholder')}
            value={value.beatBpm}
            onChange={(event) => set('beatBpm', event.target.value)}
          />
        </label>
        <label className="space-y-1.5" htmlFor={`${idPrefix}-key`}>
          <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('beats.key')}</span>
          <input
            id={`${idPrefix}-key`}
            maxLength={24}
            className="ns-field !rounded px-4 text-base sm:text-sm"
            placeholder={t('beats.keyPlaceholder')}
            value={value.beatKey}
            onChange={(event) => set('beatKey', event.target.value)}
          />
        </label>
        <label className="space-y-1.5" htmlFor={`${idPrefix}-mood`}>
          <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('beats.mood')}</span>
          <input
            id={`${idPrefix}-mood`}
            maxLength={80}
            className="ns-field !rounded px-4 text-base sm:text-sm"
            placeholder={t('beats.moodPlaceholder')}
            value={value.beatMood}
            onChange={(event) => set('beatMood', event.target.value)}
          />
        </label>
        <label className="space-y-1.5" htmlFor={`${idPrefix}-style`}>
          <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('beats.style')}</span>
          <input
            id={`${idPrefix}-style`}
            maxLength={80}
            className="ns-field !rounded px-4 text-base sm:text-sm"
            placeholder={t('beats.stylePlaceholder')}
            value={value.beatStyle}
            onChange={(event) => set('beatStyle', event.target.value)}
          />
        </label>
      </div>

      <label className="block space-y-1.5" htmlFor={`${idPrefix}-license-type`}>
        <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('beats.licenseType')}</span>
        <input
          id={`${idPrefix}-license-type`}
          maxLength={80}
          className="ns-field !rounded px-4 text-base sm:text-sm"
          placeholder={t('beats.licenseTypePlaceholder')}
          value={value.beatLicenseType}
          onChange={(event) => set('beatLicenseType', event.target.value)}
        />
      </label>

      <label className="block space-y-1.5" htmlFor={`${idPrefix}-usage-notes`}>
        <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">{t('beats.usageNotes')}</span>
        <textarea
          id={`${idPrefix}-usage-notes`}
          rows={3}
          maxLength={1000}
          className="ns-field !rounded resize-none px-4 py-3 text-base sm:text-sm"
          placeholder={t('beats.usageNotesPlaceholder')}
          value={value.beatUsageNotes}
          onChange={(event) => set('beatUsageNotes', event.target.value)}
        />
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded border border-zinc-800 bg-zinc-950/20 p-4">
        <input
          type="checkbox"
          checked={value.beatContactEnabled}
          onChange={(event) => set('beatContactEnabled', event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand-red"
        />
        <span>
          <span className="block text-sm font-semibold text-zinc-200">{t('beats.contactEnabled')}</span>
          <span className="mt-1 block text-ns-label leading-relaxed text-zinc-500">{t('beats.contactEnabledHelp')}</span>
        </span>
      </label>
    </fieldset>
  );
}
