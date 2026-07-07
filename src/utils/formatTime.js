export function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '—';
  const total = Math.floor(Number(seconds));
  const hours = Math.floor(total / 3600);
  // Individual tracks are practically always under an hour, so this only
  // changes output for the rare very-long track/mix -- formatTime's m:ss
  // output is unchanged for every value under 3600s.
  if (hours > 0) {
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return formatTime(total);
}

/**
 * Long-form duration for playlist-level totals, e.g. "40 min 30 sec" or
 * "3 hr 15 min" (matches the existing playlists.hourMinute i18n string for
 * the hour case; seconds are omitted once hours are shown, same as most
 * streaming apps, since they stop being meaningful at that scale).
 */
export function formatDurationLong(seconds, t) {
  const total = Math.floor(Number(seconds) || 0);
  if (total <= 0) return null;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return t('playlists.hourMinute', { hours, minutes });
  }
  const secs = total % 60;
  return t('playlists.minuteSecond', { minutes, seconds: secs });
}
