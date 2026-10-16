import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { connectSpotifyPlayback, importStatus } from '../../api/playlistImport';

export default function SpotifyPlaybackConnection({ playlistId }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const { data } = useQuery({ queryKey:['spotify-playback-status'], queryFn:({signal})=>importStatus(signal), staleTime:30000, refetchOnWindowFocus:true });
  async function connect() {
    setBusy(true); setError(false);
    try {
      const { url } = await connectSpotifyPlayback(playlistId);
      const target = new URL(url);
      if (target.origin !== 'https://accounts.spotify.com') throw new Error('Invalid authorization URL');
      window.location.assign(target.href);
    } catch { setBusy(false); setError(true); }
  }
  return <div className="flex flex-wrap items-center gap-3 px-1 text-sm">
    <button type="button" className="ns-button-secondary min-h-11 px-4" disabled={busy} onClick={connect}>
      {t(data?.spotifyPlaybackConnected?'playlistImport.reconnectPlayback':'playlistImport.connectPlayback')}
    </button>
    <span className="text-zinc-400">{t('playlistImport.spotifyNativeNote')}</span>
    {error&&<p role="alert" className="text-red-400">{t('playlistImport.playbackErrors.SPOTIFY_PLAYBACK_CONNECT')}</p>}
  </div>;
}
