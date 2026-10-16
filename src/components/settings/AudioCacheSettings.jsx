import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioCache, audioCacheEnabled, supportsAudioCache, setAudioCacheEnabled } from '../../services/audioCache';

export default function AudioCacheSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(audioCacheEnabled);
  const [cleared, setCleared] = useState(false);
  return <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
    <h3 className="font-semibold">{t('audioCache.title')}</h3>
    <p className="text-sm text-zinc-400">{t('audioCache.help')}</p>
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" checked={enabled} disabled={!supportsAudioCache()} onChange={event => { setEnabled(event.target.checked); setAudioCacheEnabled(event.target.checked); }} />
      {t('audioCache.enable')}
    </label>
    <button type="button" className="ns-button-secondary min-h-11 px-4" onClick={async () => { window.dispatchEvent(new Event('noirsound:audio-cache-change')); await audioCache.clear(); setCleared(true); }}>{t('audioCache.clear')}</button>
    {cleared && <p role="status" className="text-sm text-zinc-400">{t('audioCache.cleared')}</p>}
  </section>;
}
