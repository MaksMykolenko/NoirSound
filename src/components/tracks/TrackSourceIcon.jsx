import React from 'react';

const platforms = {
  AUDIUS: { name: 'Audius', color: '#a78bfa', path: 'M3 17V7h3v10zm5 3V4h3v16zm5-3V7h3v10zm5-3v-4h3v4z' },
  SPOTIFY: { name: 'Spotify', color: '#1ed760', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 14c-3-1.8-6.3-2-10-.9l-.5-1.4c4-1.2 7.9-1 11.3 1zm1-3c-3.5-2-7.4-2.4-11.7-1.1l-.6-1.6c4.8-1.5 9.2-1.1 13.2 1.3zm1-3c-4.2-2.4-8.6-2.7-13.5-1.3L5 6.8c5.4-1.6 10.5-1.2 15 1.5z' },
  SOUNDCLOUD: { name: 'SoundCloud', color: '#ff7700', path: 'M2 11h1v7H2zm2-2h1v10H4zm2-2h1v12H6zm2 3h1v9H8zm2 9V8a5 5 0 0 1 9 4 3.5 3.5 0 1 1 0 7z' },
  APPLE_MUSIC: { name: 'Apple Music', color: '#fa5265', path: 'M8 6v11a3 3 0 1 1-2-2.8V4l14-2v13a3 3 0 1 1-2-2.8V6z' },
  YOUTUBE: { name: 'YouTube', color: '#ff4444', path: 'M22 7c-.3-1.3-1-2-2.3-2.2A63 63 0 0 0 12 4.5a63 63 0 0 0-7.7.3C3 5 2.3 5.7 2 7a29 29 0 0 0 0 10c.3 1.3 1 2 2.3 2.2a63 63 0 0 0 15.4 0c1.3-.2 2-1 2.3-2.2a29 29 0 0 0 0-10zM10 16V8l7 4z' },
};

export default function TrackSourceIcon({ track, provider = track?.provider }) {
  const platform = platforms[provider];
  if (!platform) return null;
  return <span className="inline-flex shrink-0 items-center align-middle" title={platform.name} data-source-provider={provider}>
    <svg role="img" aria-label={platform.name} width="16" height="16" viewBox="0 0 24 24" style={{ color: platform.color }}>
      <path fill="currentColor" fillRule="evenodd" d={platform.path} />
    </svg>
  </span>;
}
