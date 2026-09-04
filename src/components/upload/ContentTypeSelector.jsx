import React from 'react';
import { Disc3, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const OPTIONS = [
  { value: 'MUSIC', labelKey: 'content.uploadMusic', descriptionKey: 'content.musicUploadDescription', Icon: Disc3 },
  { value: 'BEAT', labelKey: 'content.uploadBeat', descriptionKey: 'content.beatUploadDescription', Icon: Waves },
];

export default function ContentTypeSelector({ value = 'MUSIC', onChange, idPrefix = 'upload-content-type' }) {
  const { t } = useTranslation();

  return (
    <fieldset className="space-y-2.5" data-testid="content-type-selector">
      <legend className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">
        {t('content.uploadAs')}
      </legend>
      <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2" role="radiogroup" aria-label={t('content.uploadAs')}>
        {OPTIONS.map(({ value: optionValue, labelKey, descriptionKey, Icon }) => {
          const selected = value === optionValue;
          return (
            <label
              key={optionValue}
              htmlFor={`${idPrefix}-${optionValue.toLowerCase()}`}
              className={`flex min-h-20 cursor-pointer items-start gap-3 rounded border p-3.5 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ns-accent)] ${
                selected
                  ? 'border-brand-red/55 bg-brand-red/10 text-zinc-100'
                  : 'border-zinc-800 bg-zinc-950/25 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <input
                id={`${idPrefix}-${optionValue.toLowerCase()}`}
                type="radio"
                aria-label={t(labelKey)}
                aria-describedby={`${idPrefix}-${optionValue.toLowerCase()}-help`}
                name={idPrefix}
                value={optionValue}
                checked={selected}
                onChange={() => onChange(optionValue)}
                className="sr-only"
              />
              <Icon size={18} className={selected ? 'mt-0.5 shrink-0 text-brand-red' : 'mt-0.5 shrink-0 text-zinc-600'} />
              <span className="min-w-0">
                <span className="block text-sm font-bold">{t(labelKey)}</span>
                <span id={`${idPrefix}-${optionValue.toLowerCase()}-help`} className="mt-1 block text-ns-label leading-relaxed text-zinc-500">{t(descriptionKey)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
