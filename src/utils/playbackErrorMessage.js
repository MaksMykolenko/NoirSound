const MEDIA_SOURCE_ERROR = /no supported source|no supported sources|processed audio stream could not be loaded|audio playback failed/i;

export function resolvePlaybackErrorMessage(error, {
  mockMode = false,
  demoMessage = 'Demo audio source is unavailable',
  unavailableMessage = 'Audio unavailable',
} = {}) {
  const rawMessage = String(error || '').trim();
  if (!rawMessage) return '';
  if (!MEDIA_SOURCE_ERROR.test(rawMessage)) return rawMessage;
  return mockMode ? demoMessage : unavailableMessage;
}
